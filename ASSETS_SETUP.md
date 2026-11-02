# Lokal asset quraşdırması

Bu repository yalnız layihənin mənbə kodunu paylaşır. Point Blank-dən çıxarılmış
modellər, teksturalar, səslər, xəritələr və digər oyun assetləri GitHub-a daxil
edilmir.

## İlk quraşdırma

1. Repository-ni klonlayın.
2. Kök qovluqda `npm install` işlədin.
3. `server` qovluğunda ayrıca `npm install` işlədin.
4. `server/.env.example` faylını `server/.env.local` adı ilə kopyalayın və lokal
   verilənlər bazası parametrlərini yazın.
5. Asset sahibindən `public/assets` qovluğunu GitHub-dan kənar, şəxsi üsulla
   götürüb layihədə eyni yerə yerləşdirin.
6. `npm run dev:all` ilə client və serveri başladın.

## Paylaşılmayan lokal fayllar

- `public/assets/`
- `extracted/`, `.tmp/`, `.asset-snapshots/`
- `node_modules/`, `dist/`, `logs/`
- `server/.env.local` və digər `.env` faylları

Bu qovluqlar `.gitignore` ilə qorunur. Yeni asset və ya məxfi parametr əlavə
edəndə onun commit siyahısına düşmədiyini `git status` ilə yoxlayın.
