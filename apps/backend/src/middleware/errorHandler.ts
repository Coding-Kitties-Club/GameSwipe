import { Request, Response, NextFunction } from "express";
import { ApiError } from "../errors";


export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {

    if (err instanceof ApiError) {
        res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details ?? null
            }
        });
        return;
    }

    res.status(500).json({
        error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected Server Error",
            details: null
        }
    });
}