const fs = require("fs");
const path = require("path");

function pad(n) {
  return n.toString().padStart(2, "0");
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function processFile(file) {
  fs.stat(file, (err, stats) => {
    if (err) {
      console.error(`Error reading ${file}:`, err);
      return;
    }
    const d = new Date(stats.mtime);
    const timestamp = formatDate(d);
    fs.readFile(file, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading ${file}:`, err);
        return;
      }
      if (data.includes("YYYY-MM-DD HH:MM:SS")) {
        const updated = data.replace(/YYYY-MM-DD HH:MM:SS/g, timestamp);
        fs.writeFile(file, updated, "utf8", err => {
          if (err) {
            console.error(`Error writing ${file}:`, err);
          } else {
            console.log(`Updated ${file} with timestamp ${timestamp}`);
          }
        });
      }
    });
  });
}

function walk(dir) {
  fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
    if (err) {
      console.error(`Error reading directory ${dir}:`, err);
      return;
    }
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        processFile(fullPath);
      }
    });
  });
}

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: bun get-task-timestamps.js <folder>");
  process.exit(1);
}
walk(folder);
