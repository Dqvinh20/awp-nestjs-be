import { Module } from '@nestjs/common';
import { ClassGradesService } from './class_grades.service';
import { ClassGradesController } from './class_grades.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
	ClassGrade,
	ClassGradeSchemaFactory,
} from './entities/class_grade.entity';
import { ClassesModule } from '@modules/classes/classes.module';

@Module({
	imports: [
		MongooseModule.forFeatureAsync([
			{
				name: ClassGrade.name,
				useFactory: ClassGradeSchemaFactory,
			},
		]),
		ClassesModule,
	],
	controllers: [ClassGradesController],
	providers: [ClassGradesService],
	exports: [ClassGradesService],
})
export class ClassGradesModule {}
