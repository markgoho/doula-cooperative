function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function getCurrentTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year.toString()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

console.log(getCurrentTimestamp());
