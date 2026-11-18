export const Platform = {
  OS: 'ios',
  select: (options: Record<string, unknown>) => options.ios ?? options.default,
};

export const useWindowDimensions = () => ({
  width: 390,
  height: 844,
  scale: 3,
  fontScale: 1,
});

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};
