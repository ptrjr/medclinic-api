import type { Request, Response } from 'express';
import {
  createMedicalRecordSchema,
  listMedicalRecordsQuerySchema,
} from '../dtos/medical-record.dto';
import { patientIdSchema } from '../dtos/patient.dto';
import { AppError } from '../errors/app-error';
import type { MedicalRecordService } from '../services/medical-record.service';

export class MedicalRecordController {
  constructor(private readonly records: MedicalRecordService) {}

  public async create(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const patientId = patientIdSchema.parse(request.params.patientId);
    const input = createMedicalRecordSchema.parse(request.body as unknown);
    response.status(201).json(await this.records.create(patientId, input, request.user));
  }

  public async list(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const patientId = patientIdSchema.parse(request.params.patientId);
    const query = listMedicalRecordsQuerySchema.parse(request.query);
    response.status(200).json(await this.records.list(patientId, query, request.user));
  }
}
