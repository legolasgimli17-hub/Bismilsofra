import tempfile,unittest
from pathlib import Path
from PIL import Image
from import_food_photo import import_photo
class PhotoImportTests(unittest.TestCase):
    def test_photo_is_resized_and_exif_stripped(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);src=d/'original.jpg';Image.new('RGB',(2400,1500),(180,90,55)).save(src)
            out=import_photo(src,'pilot-ornek',d/'public')
            self.assertTrue(out.exists())
            with Image.open(out) as image:
                self.assertLessEqual(image.width,1600)
                self.assertEqual(image.format,'WEBP')
                self.assertFalse(image.getexif())
    def test_reject_unsafe_name(self):
        with tempfile.TemporaryDirectory() as d:
            src=Path(d)/'input.jpg';Image.new('RGB',(10,10)).save(src)
            with self.assertRaises(ValueError):import_photo(src,'../../dosya',Path(d))
if __name__=='__main__':unittest.main()
