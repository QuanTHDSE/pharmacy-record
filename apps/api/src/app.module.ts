import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AllergiesModule } from './modules/allergies/allergies.module.js';
import { DiseasesModule } from './modules/diseases/diseases.module.js';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module.js';
import { PatientDiseasesModule } from './modules/patient-diseases/patient-diseases.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AuthModule,
    PatientsModule,
    MedicalRecordsModule,
    DiseasesModule,
    PatientDiseasesModule,
    AllergiesModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
