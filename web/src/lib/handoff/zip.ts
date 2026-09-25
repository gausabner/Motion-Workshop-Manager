import { deflateRawSync } from "node:zlib";

/**
 * A ZIP file, written by hand.
 *
 * The bundle is the concrete form of the promise that a workshop's data is
 * never withheld, and the disaster-recovery answer council IT asks for before
 * signing. It is also the one deliverable where a dependency would be hardest
 * to justify: the format is thirty years old, frozen, and the part of it we
 * need is a header, a deflate stream and a table of contents. This codebase
 * already signs S3 requests by hand for the same reason.
 *
 * Deliberately not streaming. Every entry is held until the central directory
 * is written, because the directory has to come last and has to know each
 * entry's size and checksum. That caps the bundle at what fits in memory,
 * which is why the caller counts rows before building one and why the limits
 * below are stated rather than discovered.
 *
 * Limits, which are the format's rather than ours: 65,535 entries and 4 GB per
 * entry before ZIP64 is needed, which this does not write. A workshop bundle
 * is a few dozen CSVs; if either limit is ever approached the build throws
 * rather than producing an archive that some tools open and others do not.
 */

const MAX_ENTRIES = 0xffff;
const MAX_BYTES = 0xffffffff;

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }
    return table;
})();

export function crc32(buffer: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/**
 * The modification time, as MS-DOS packed it in 1980 and as ZIP still does.
 *
 * Seconds have one bit less than they need, so they are stored in twos and odd
 * seconds do not survive. Nothing depends on that; it is recorded here so the
 * next person does not go looking for the missing second.
 */
function dosTime(at: Date): { time: number; date: number } {
    const year = Math.max(1980, at.getFullYear());
    return {
        time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
        date: ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
    };
}

export type ZipEntry = { name: string; body: Buffer | string };

export function zip(entries: ZipEntry[], at: Date = new Date()): Buffer {
    if (entries.length > MAX_ENTRIES) throw new Error(`A ZIP written this way holds ${MAX_ENTRIES} entries; this bundle has ${entries.length}.`);

    const { time, date } = dosTime(at);
    const locals: Buffer[] = [];
    const directory: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const body = Buffer.isBuffer(entry.body) ? entry.body : Buffer.from(entry.body, "utf8");
        if (body.length > MAX_BYTES) throw new Error(`${entry.name} is larger than a ZIP entry can hold without ZIP64.`);

        const deflated = deflateRawSync(body);
        // A file that deflates larger than it started — a short one, or one
        // already compressed — is stored as it is. The reader handles both,
        // and an archive that grew is a silly thing to hand somebody.
        const stored = deflated.length >= body.length;
        const payload = stored ? body : deflated;
        const method = stored ? 0 : 8;
        const sum = crc32(body);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);            // version needed
        local.writeUInt16LE(0x0800, 6);        // UTF-8 names
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(sum, 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(body.length, 22);
        local.writeUInt16LE(name.length, 26);
        locals.push(local, name, payload);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);          // version made by
        central.writeUInt16LE(20, 6);          // version needed
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(sum, 16);
        central.writeUInt32LE(payload.length, 20);
        central.writeUInt32LE(body.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);     // where its local header starts
        directory.push(central, name);

        offset += local.length + name.length + payload.length;
    }

    const centralBytes = directory.reduce((total, b) => total + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBytes, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...locals, ...directory, end]);
}
