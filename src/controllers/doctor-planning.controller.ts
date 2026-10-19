import type { Request, Response } from 'express';
import { calendarQuerySchema } from '../dtos/calendar.dto';
import { planningDoctorIdSchema, replaceWorkScheduleSchema } from '../dtos/work-schedule.dto';
import { AppError } from '../errors/app-error';
import type { DoctorCalendarService } from '../services/doctor-calendar.service';
import type { WorkScheduleService } from '../services/work-schedule.service';

export class DoctorPlanningController {
  constructor(
    private readonly schedules: WorkScheduleService,
    private readonly calendar: DoctorCalendarService,
  ) {}

  public async replaceSchedule(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const id = planningDoctorIdSchema.parse(request.params.doctorId);
    const input = replaceWorkScheduleSchema.parse(request.body as unknown);
    response.status(200).json(await this.schedules.replace(id, input, request.user));
  }

  public async getSchedule(request: Request, response: Response): Promise<void> {
    const id = planningDoctorIdSchema.parse(request.params.doctorId);
    response.status(200).json(await this.schedules.get(id));
  }

  public async getCalendar(request: Request, response: Response): Promise<void> {
    const id = planningDoctorIdSchema.parse(request.params.doctorId);
    const query = calendarQuerySchema.parse(request.query);
    response.status(200).json(await this.calendar.get(id, query));
  }
}
