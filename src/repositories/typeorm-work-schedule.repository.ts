import type { DataSource } from 'typeorm';
import type { WorkShift } from '../domain/work-schedule';
import { DoctorEntity } from '../entities/doctor.entity';
import { WorkScheduleEntity } from '../entities/work-schedule.entity';
import { AppError } from '../errors/app-error';
import type { WorkScheduleRepositoryPort } from '../ports/work-schedule-repository.port';

export class TypeOrmWorkScheduleRepository implements WorkScheduleRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  public async getShifts(doctorId: string): Promise<WorkShift[]> {
    return (
      (await this.dataSource.getRepository(WorkScheduleEntity).findOneBy({ doctorId }))?.shifts ??
      []
    );
  }

  public async replaceShifts(doctorId: string, shifts: WorkShift[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Usa o mesmo bloqueio de médico que o módulo de agendamentos utilizará.
      const doctor = await manager
        .getRepository(DoctorEntity)
        .findOne({ where: { id: doctorId }, lock: { mode: 'pessimistic_write' } });
      if (!doctor) throw new AppError('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado.');
      // Uma gravação substitui o JSON inteiro, sem DELETE/INSERT de turnos parciais.
      await manager.getRepository(WorkScheduleEntity).upsert({ doctorId, shifts }, ['doctorId']);
    });
  }
}
