export type TrainManifest = {
  lead: string;
  tail: string;
  middle: string;
  pantograph: string;
  pantographCars: number[];
  cars: number;
  length: number;
  endLength: number;
  scale: number;
  verticalOffset: number;
  source: string;
};
/** Highest-numbered car leads; car 1 trails. Distances are centre to centre. */
export function formation(manifest: TrainManifest) {
  let offset = 0;
  let previousLength = manifest.endLength;
  return Array.from({ length: manifest.cars }, (_, i) => {
    const number = manifest.cars - i;
    const end = i === 0 || i === manifest.cars - 1;
    const length = end ? manifest.endLength : manifest.length;
    if (i) offset += (previousLength + length) / 2;
    previousLength = length;
    const file =
      i === 0
        ? manifest.lead
        : i === manifest.cars - 1
          ? manifest.tail
          : manifest.pantographCars.includes(number)
            ? manifest.pantograph
            : manifest.middle;
    return { number, offset, length, file, reversed: i === manifest.cars - 1 };
  });
}
