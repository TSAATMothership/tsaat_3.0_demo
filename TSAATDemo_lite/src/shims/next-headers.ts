export function headers(): Headers {
  return new Headers();
}

export function cookies() {
  return {
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined
  };
}
