import type { Request, Response } from 'express';
import { createDoctorSchema, doctorIdSchema, listDoctorsQuerySchema } from '../dtos/doctor.dto';
import { AppError } from '../errors/app-error';
import type { DoctorService } from '../services/doctor.service';

export class DoctorController {
  constructor(private readonly doctors: DoctorService) {}

  public async create(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const input = createDoctorSchema.parse(request.body as unknown);
    response.status(201).json(await this.doctors.create(input, request.user));
  }

  public async list(request: Request, response: Response): Promise<void> {
    const query = listDoctorsQuerySchema.parse(request.query);
    response.status(200).json(await this.doctors.list(query));
  }

  public async getById(request: Request, response: Response): Promise<void> {
    const id = doctorIdSchema.parse(request.params.id);
    response.status(200).json(await this.doctors.getById(id));
  }
}
