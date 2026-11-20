import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DomainError} from '../src/domain.ts';
import {imageSignature,prepareRestaurantPhoto,photoStorageSettings,photoObjectKey,photoPublicUrl} from '../src/media-service.ts';
const rejected=(code:string)=>(e:unknown)=>e instanceof DomainError&&e.code===code;
test('accepts only JPEG, PNG or WebP actual binary signatures',async()=>{
 const input=await sharp({create:{width:120,height:100,channels:3,background:{r:100,g:180,b:40}}}).png().toBuffer();
 assert.equal(imageSignature(input),'png');
 assert.equal(imageSignature(Buffer.from('<svg><script>alert(1)</script></svg>')) ,null);
 assert.equal(imageSignature(Buffer.from('RIFF1234AVI FAKE DATA')) ,null);
 assert.equal(imageSignature(Buffer.alloc(3)),null);
});
test('produces metadata-free, bounded WebP with correct orientation',async()=>{
 const input=await sharp({create:{width:1700,height:1100,channels:3,background:{r:225,g:95,b:43}}})
  .jpeg({quality:90}).toBuffer();
 const prepared=await prepareRestaurantPhoto(input);
 assert.equal(prepared.sourceFormat,'jpeg');
 assert.ok(prepared.width<=1600&&prepared.height<=1200);
 assert.ok(prepared.bytes.length>0&&prepared.bytes.length<=3*1024*1024);
 assert.equal(imageSignature(prepared.bytes),'webp');
 const meta=await sharp(prepared.bytes).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);
 assert.equal(meta.width,prepared.width);assert.equal(meta.height,prepared.height);
});
test('rejects large, invalid, tiny and malicious image data',async()=>{
 await assert.rejects(()=>prepareRestaurantPhoto(Buffer.alloc(5*1024*1024+1)),rejected('PHOTO_SIZE'));
 await assert.rejects(()=>prepareRestaurantPhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),rejected('PHOTO_TYPE'));
 await assert.rejects(()=>prepareRestaurantPhoto(Buffer.alloc(0)),rejected('PHOTO_SIZE'));
 const tiny=await sharp({create:{width:20,height:20,channels:3,background:{r:0,g:0,b:0}}}).png().toBuffer();
 await assert.rejects(()=>prepareRestaurantPhoto(tiny),rejected('PHOTO_INVALID'));
 const corrupted=Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(200,0)]);
 await assert.rejects(()=>prepareRestaurantPhoto(corrupted),rejected('PHOTO_INVALID'));
});
const good:NodeJS.ProcessEnv={
 NODE_ENV:'test',S3_ENDPOINT:'http://127.0.0.1:9000/',S3_BUCKET:'bismil-sofra-test',S3_REGION:'auto',
 S3_ACCESS_KEY_ID:'CIACCESS',S3_SECRET_ACCESS_KEY:'ci-secret-key-do-not-use',
 MEDIA_PUBLIC_ORIGIN:'https://assets.bismilsofra.example',PUBLIC_IMAGE_CDN_HOST:'assets.bismilsofra.example'
};
test('S3/CDN config fails closed on misconfigured hosts and non-TLS production',()=>{
 const settings=photoStorageSettings(good);assert.ok(settings);
 assert.equal(settings.host,'assets.bismilsofra.example');
 assert.equal(photoStorageSettings({...good,NODE_ENV:'production'}),null);
 assert.equal(photoStorageSettings({...good,S3_ENDPOINT:'https://storage.attacker.invalid/',NODE_ENV:'production',
  MEDIA_PUBLIC_ORIGIN:'http://assets.bismilsofra.example'}),null);
 assert.equal(photoStorageSettings({...good,PUBLIC_IMAGE_CDN_HOST:'attacker.invalid'}),null);
 assert.equal(photoStorageSettings({...good,S3_SECRET_ACCESS_KEY:''}),null);
});
test('object paths are unpredictable and only belong to the requested restaurant',()=>{
 const cfg=photoStorageSettings(good)!;
 const rid='11111111-1111-4111-8111-111111111111';
 const k1=photoObjectKey(rid),k2=photoObjectKey(rid);
 assert.notEqual(k1,k2);
 assert.match(k1,/^restaurants\/11111111-1111-4111-8111-111111111111\/photos\/[a-f0-9-]{36}\.webp$/);
 assert.equal(photoPublicUrl(cfg,k1),'https://assets.bismilsofra.example/'+k1);
 assert.throws(()=>photoPublicUrl(cfg,'../secret'));
});
