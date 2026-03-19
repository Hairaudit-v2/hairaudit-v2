import type en from "./translations/en.json";

/** Dot-separated paths to string leaf values in en.json (e.g. `nav.home`). */
export type TranslationKey = Leaves<typeof en>;

type Leaves<T, P extends string = ""> = T extends string
  ? P extends ""
    ? never
    : P
  : T extends object
    ? {
        [K in keyof T & string]: Leaves<
          T[K],
          P extends "" ? `${K}` : `${P}.${K}`
        >;
      }[keyof T & string]
    : never;
