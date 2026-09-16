# Memindahkan Kasir Miso ke komputer lain

ZIP portable ini berisi source code dan asset Kasir Miso, tetapi tidak berisi
secret atau token. File berikut harus tetap disimpan di pengelola secret, bukan
diarsipkan:

- `SESSION_SECRET`
- `EXPO_TOKEN`

## Menjalankan di komputer baru

1. Install Node.js dan pnpm.
2. Extract ZIP.
3. Dari folder hasil extract, jalankan:

   ```bash
   pnpm install --filter @workspace/kasir-miso...
   ```

4. Jalankan aplikasi:

   ```bash
   pnpm --filter @workspace/kasir-miso run dev
   ```

> Jangan memasukkan `SESSION_SECRET` atau
> `EXPO_TOKEN` ke ZIP, Git, atau aplikasi mobile.