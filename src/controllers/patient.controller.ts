import type { Request, Response } from 'express';
import {
  createPatientSchema,
  listPatientsQuerySchema,
  patientIdSchema,
  updatePatientSchema,
} from '../dtos/patient.dto';
import type { PatientService } from '../services/patient.service';

export class PatientController {
  constructor(private readonly patients: PatientService) {}

  public async create(request: Request, response: Response): Promise<void> {
    response.status(201).json(await this.patients.create(createPatientSchema.parse(request.body)));
  }

  public async list(request: Request, response: Response): Promise<void> {
    response
      .status(200)
      .json(await this.patients.list(listPatientsQuerySchema.parse(request.query)));
  }

  public async getById(request: Request, response: Response): Promise<void> {
    response
      .status(200)
      .json(await this.patients.getById(patientIdSchema.parse(request.params.id)));
  }

  public async update(request: Request, response: Response): Promise<void> {
    const id = patientIdSchema.parse(request.params.id);
    response
      .status(200)
      .json(await this.patients.update(id, updatePatientSchema.parse(request.body)));
  }

  public async delete(request: Request, response: Response): Promise<void> {
    await this.patients.delete(patientIdSchema.parse(request.params.id));
    response.status(204).send();
  }
}
