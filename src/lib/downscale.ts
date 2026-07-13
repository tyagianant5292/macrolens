/// Shrink a camera photo before it leaves the phone.
///
/// A modern phone camera hands you an 8–12MB, 4000px JPEG. None of that helps: the model
/// downsamples anyway, and the bytes land in Postgres. 1024px on the long edge is plenty to
/// read a plate and lands around 80KB — a ~100x saving, and it turns a slow upload on gym wifi
/// into an instant one.
const MAX_EDGE = 1024;
const QUALITY = 0.8;

export async function downscale(file: File): Promise<File> {
  // HEIC (iPhone default) can't be decoded by canvas in most browsers. Send it untouched and
  // let the server reject it with a clear message rather than silently corrupting it here.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  // Already small enough — re-encoding would only lose quality.
  if (scale === 1 && file.size < 1_000_000) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) return file;

  return new File([blob], "meal.jpg", { type: "image/jpeg" });
}
