# Viet Culture Map – Image assets

Structure: `img/<Province>/<category>/`

Each locality has four folders:
- `province`: province cover / representative image; used as the detail-page background when its path is set in `summary.image.file`
- `destinations`: landmarks, attractions and destinations
- `culture`: festivals, arts, traditions, costumes and cultural heritage
- `specialties`: local dishes, ingredients and regional specialties

Images originally nested under former-province folders have been placed into the corresponding parent locality and classified by subject. Category folders without suitable source images are kept empty. Image filenames use English descriptions; local proper names are retained in romanized form where appropriate.

**Source-file exceptions:** 2 files with `.jpg` extensions contained HTML pages rather than image data and were excluded from the image folders. They are listed in `image-manifest.csv` with status `excluded_invalid_html_not_image`.

`image-manifest.csv` lists every source file, its new path and classification status.
