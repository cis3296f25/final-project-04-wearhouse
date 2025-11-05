export async function removeBackgroundOnServer(file) {
  const fd = new FormData();
  fd.append("file", file);

  const resp = await fetch("http://localhost:3001/remove-bg", {
    method: "POST",
    body: fd,
  });

  const ct = resp.headers.get("content-type") || "";
  if (!resp.ok || !ct.includes("image/png")) {
    const txt = await resp.text();
    throw new Error(`remove-bg failed (${resp.status}): ${txt}`);
  }

  const ab = await resp.arrayBuffer();
  const cleanedName = file.name.replace(/\.\w+$/, "") + "-nobg.png";
  return new File([ab], cleanedName, { type: "image/png" });
}
