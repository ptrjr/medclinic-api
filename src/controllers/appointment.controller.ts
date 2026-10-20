import type { Request, Response } from 'express';
import {
  appointmentIdSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentStatusSchema,
} from '../dtos/appointment.dto';
import { AppError } from '../errors/app-error';
import type { AppointmentService } from '../services/appointment.service';

export class AppointmentController {
  constructor(private readonly appointments: AppointmentService) {}

  public async create(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const input = createAppointmentSchema.parse(request.body as unknown);
    response.status(201).json(await this.appointments.create(input, request.user));
  }

  public async list(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const query = listAppointmentsQuerySchema.parse(request.query);
    response.status(200).json(await this.appointments.list(query, request.user));
  }

  public async getById(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const id = appointmentIdSchema.parse(request.params.id);
    response.status(200).json(await this.appointments.getById(id, request.user));
  }

  public async changeStatus(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const id = appointmentIdSchema.parse(request.params.id);
    const input = updateAppointmentStatusSchema.parse(request.body as unknown);
    response.status(200).json(await this.appointments.changeStatus(id, input.status, request.user));
  }
}
