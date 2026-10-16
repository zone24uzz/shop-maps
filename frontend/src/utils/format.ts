/** Five decimals is roughly one metre of precision, enough to locate a store. */
const COORDINATE_DECIMALS = 5;

export function formatCoordinate(value: number): string {
  return value.toFixed(COORDINATE_DECIMALS);
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${formatCoordinate(lat)}, ${formatCoordinate(lng)}`;
}

/** Local time as HH:MM:SS, independent of the browser locale. */
export function formatClockTime(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function openStreetMapUrl(lat: number, lng: number): string {
  const position = `${formatCoordinate(lat)}/${formatCoordinate(lng)}`;
  return `https://www.openstreetmap.org/?mlat=${formatCoordinate(lat)}&mlon=${formatCoordinate(lng)}#map=17/${position}`;
}
