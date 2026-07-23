(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.zipArchive = {
    createZipBlob,
    crc32
  };

  function createZipBlob(files, now = new Date()) {
    const chunks = [];
    const centralDirectory = [];
    const dos = toDosDateTime(now);
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = encodeUtf8(file.name);
      const contentBytes = encodeUtf8(file.content);
      const crc = crc32(contentBytes);
      const localHeader = concatBytes(
        u32(0x04034b50),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(dos.time),
        u16(dos.date),
        u32(crc),
        u32(contentBytes.length),
        u32(contentBytes.length),
        u16(nameBytes.length),
        u16(0)
      );

      chunks.push(localHeader, nameBytes, contentBytes);
      centralDirectory.push({ nameBytes, crc, size: contentBytes.length, offset });
      offset += localHeader.length + nameBytes.length + contentBytes.length;
    });

    const centralOffset = offset;
    centralDirectory.forEach((entry) => {
      const header = concatBytes(
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(dos.time),
        u16(dos.date),
        u32(entry.crc),
        u32(entry.size),
        u32(entry.size),
        u16(entry.nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(entry.offset)
      );
      chunks.push(header, entry.nameBytes);
      offset += header.length + entry.nameBytes.length;
    });

    const centralSize = offset - centralOffset;
    chunks.push(concatBytes(
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(centralDirectory.length),
      u16(centralDirectory.length),
      u32(centralSize),
      u32(centralOffset),
      u16(0)
    ));

    return new Blob(chunks, { type: "application/zip" });
  }

  function encodeUtf8(value) {
    return new TextEncoder().encode(String(value ?? ""));
  }

  function concatBytes(...parts) {
    const size = parts.reduce((total, part) => total + part.length, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;

    parts.forEach((part) => {
      bytes.set(part, offset);
      offset += part.length;
    });

    return bytes;
  }

  function u16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
  }

  function u32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  }

  function toDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function crc32(bytes) {
    let crc = 0xffffffff;

    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }
})(globalThis);
