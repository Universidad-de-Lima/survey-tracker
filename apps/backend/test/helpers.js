/**
 * Doble de `res` de Vercel, compartido por los tests de los endpoints.
 *
 * `writeHead` cubre el redirect de `qr-scan`; `end(body)` la página de gracias de
 * `done`; el resto responde a las llamadas JSON de los demás endpoints.
 */
export function createRes() {
  return {
    statusCode: undefined,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = { ...this.headers, ...headers };
      return this;
    },
    end(body) {
      if (body !== undefined) {
        this.body = body;
      }
      return this;
    },
  };
}
