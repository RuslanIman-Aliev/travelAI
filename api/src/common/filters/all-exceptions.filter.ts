import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
};

type Described = Pick<ErrorBody, 'statusCode' | 'message'>;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.describe(exception, request);

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    } satisfies ErrorBody);
  }

  private describe(exception: unknown, request: Request): Described {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();

      if (statusCode >= 500) {
        this.logger.error(
          `${statusCode} on ${request.method} ${request.url}`,
          exception.stack,
        );
      }

      return { statusCode, message: this.messageFrom(exception) };
    }

    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.issues.map((issue) =>
          issue.path.length > 0
            ? `${issue.path.join('.')}: ${issue.message}`
            : issue.message,
        ),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception, request);
    }

    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    };
  }

  private messageFrom(exception: HttpException): string | string[] {
    const body: unknown = exception.getResponse();

    if (typeof body === 'string') {
      return body;
    }

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const { message } = body as { message: unknown };

      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.map((item) => String(item));
    }

    return exception.message;
  }

  private fromPrisma(
    exception: Prisma.PrismaClientKnownRequestError,
    request: Request,
  ): Described {
    switch (exception.code) {
      case 'P2002': {
        const target: unknown = exception.meta?.target;
        const field = Array.isArray(target) ? String(target[0]) : 'Field';

        return {
          statusCode: HttpStatus.CONFLICT,
          message: `${field.charAt(0).toUpperCase()}${field.slice(1)} already exists`,
        };
      }

      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        };

      default:
        this.logger.error(
          `Prisma ${exception.code} on ${request.method} ${request.url}`,
          exception.message,
        );

        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred',
        };
    }
  }
}
