/** Time in a bay, the way a workshop says it: "45 min", "2 h 15 min", "3 d 4 h". */
export function duration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    if (h < 24) return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`;
    const d = Math.floor(h / 24);
    return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}
