export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const notFound = (message = 'Not found') => new HttpError(404, 'not_found', message);
