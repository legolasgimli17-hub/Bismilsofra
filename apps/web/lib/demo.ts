import type {Restaurant,MenuProduct,Zone} from './types';
// Fictional content used only for visual and UX preview. No restaurant is verified or orderable.
export const DEMO_ZONES:Zone[]=[{id:'demo-zone-1',name:'Örnek merkez mahallesi'},{id:'demo-zone-2',name:'Örnek yeni yerleşim'},{id:'demo-zone-3',name:'Örnek çevre bölgesi'}];
export const DEMO_CATEGORIES=['Kebap','Pide','Burger','Döner','Ev Yemekleri','Çiğköfte'] as const;
export const PHOTO={
  kebap:'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=84',
  pide:'https://images.pexels.com/photos/7545572/pexels-photo-7545572.jpeg?auto=compress&cs=tinysrgb&w=1200',
  burger:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=84',
  doner:'https://images.pexels.com/photos/15202777/pexels-photo-15202777.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ev:'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=84',
  cig:'https://images.pexels.com/photos/9399948/pexels-photo-9399948.jpeg?auto=compress&cs=tinysrgb&w=1200',
  pilav:'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=84',
  pizza:'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=84',
};
export type DemoRestaurant=Restaurant&{category:string;tagline:string;zones:string[]};
export const DEMO_RESTAURANTS:DemoRestaurant[]=[
 {id:'demo-ocak',name:'Örnek Ocakbaşı',slug:'ornek-ocak',cover_url:PHOTO.kebap,category:'Kebap',tagline:'Izgaralar ve özel kebaplar',zones:['demo-zone-1','demo-zone-2'],is_open:true,is_busy:false,accepts_orders:true,min_basket_kurus:20000,delivery_fee_kurus:1500},
 {id:'demo-firin',name:'Örnek Taş Fırın',slug:'ornek-firin',cover_url:PHOTO.pide,category:'Pide',tagline:'Pide ve fırın lezzetleri',zones:['demo-zone-1','demo-zone-3'],is_open:true,is_busy:false,accepts_orders:true,min_basket_kurus:15000,delivery_fee_kurus:1000},
 {id:'demo-burger',name:'Örnek Burger Evi',slug:'ornek-burger',cover_url:PHOTO.burger,category:'Burger',tagline:'Burger ve atıştırmalıklar',zones:['demo-zone-1','demo-zone-2','demo-zone-3'],is_open:true,is_busy:false,accepts_orders:true,min_basket_kurus:18000,delivery_fee_kurus:2000},
 {id:'demo-doner',name:'Örnek Dönerci',slug:'ornek-doner',cover_url:PHOTO.doner,category:'Döner',tagline:'Dürüm ve döner çeşitleri',zones:['demo-zone-1','demo-zone-2'],is_open:true,is_busy:false,accepts_orders:true,min_basket_kurus:13000,delivery_fee_kurus:1500},
 {id:'demo-ev',name:'Örnek Ev Mutfağı',slug:'ornek-ev',cover_url:PHOTO.ev,category:'Ev Yemekleri',tagline:'Günlük ev yemekleri',zones:['demo-zone-2','demo-zone-3'],is_open:false,is_busy:false,accepts_orders:false,min_basket_kurus:18000,delivery_fee_kurus:0},
 {id:'demo-cig',name:'Örnek Çiğköfteci',slug:'ornek-cig',cover_url:PHOTO.cig,category:'Çiğköfte',tagline:'Dürüm ve porsiyonlar',zones:['demo-zone-1','demo-zone-2','demo-zone-3'],is_open:true,is_busy:false,accepts_orders:true,min_basket_kurus:12000,delivery_fee_kurus:1000},
];
const foods:Record<string,Array<[string,string,number,string]>>={
 'demo-ocak':[['Adana dürüm','Lavaş, közlenmiş biber ve yeşillik',18000,PHOTO.kebap],['Izgara kebap tabağı','Mevsim salatası ile',26000,PHOTO.kebap],['Tavuk şiş','Izgara tavuk ve garnitür',22000,PHOTO.kebap]],
 'demo-firin':[['Kıymalı pide','Taş fırında pişen kıymalı pide',21000,PHOTO.pide],['Karışık pide','Peynir ve sucuklu pide',24000,PHOTO.pide],['Fırın pidesi','Taze fırın hamuru',13500,PHOTO.pide]],
 'demo-burger':[['Klasik burger','Dana köfte, cheddar ve turşu',19000,PHOTO.burger],['Cheeseburger','Çift peynir ve burger sos',22500,PHOTO.burger],['Burger menü','Burger ve patates',26500,PHOTO.burger]],
 'demo-doner':[['Döner dürüm','Lavaşta döner ve salata',14500,PHOTO.doner],['Döner porsiyon','Pilav ile döner',23000,PHOTO.doner],['Döner ekmek','Taze ekmek arası döner',13500,PHOTO.doner]],
 'demo-ev':[['Günlük ev yemeği','Günün hazırlanan ana yemeği',17000,PHOTO.ev],['Tavuklu pilav','Günlük pişen pilav',15000,PHOTO.pilav],['Ev usulü tabak','Günlük hazırlanan tabak',20000,PHOTO.ev]],
 'demo-cig':[['Çiğköfte dürüm','Lavaş, yeşillik ve limon',10000,PHOTO.cig],['Çiğköfte porsiyon','Bol yeşillik ile',14500,PHOTO.cig],['Aile paketi','Paylaşmalık çiğköfte tabağı',22000,PHOTO.cig]],
};
export function demoMenu(id:string):MenuProduct[]{return (foods[id]||[]).map((f,i)=>({id:`demo-product-${id}-${i}`,category_id:null,name:f[0],description:f[1],price_kurus:f[2],image_url:f[3],available:true,optionGroups:[]}));}
