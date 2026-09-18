import { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500
  const message = err.message || 'Internal server error'
  res.status(statusCode).json({ error: message })
}
