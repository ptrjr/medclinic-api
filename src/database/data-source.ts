import 'dotenv/config';
import { parseDatabaseEnvironment } from '../config/environment';
import { createDataSource } from './create-data-source';

// Export único para o CLI de migrations do TypeORM.
export const AppDataSource = createDataSource(parseDatabaseEnvironment(process.env));
