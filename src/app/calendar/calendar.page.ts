import { MESESLABELS, DIASHEADER } from './../common/constants';
import { Component, ViewChild, ElementRef } from '@angular/core';
import { IRecord, ICalendar, ISimpleAlertOptions } from 'src/app/common/models';
import { handleError } from 'src/app/common/handleError';
import { MONTHSLABELS, WEEKDAYSHEADER } from 'src/app/common/constants';
import { filterStudentsList } from 'src/app/common/search';
import { AlertController } from '@ionic/angular';
import { AmaranthusDBProvider } from 'src/app/services/amaranthus-db/amaranthus-db';
import { ActivatedRoute } from '@angular/router';
import { Storage } from '@ionic/storage';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
})
export class CalendarPage {
  currentDate: string;
  students: IRecord[];
  private unfilteredStudents: IRecord[];
  private date: ICalendar;
  timer;
  @ViewChild('notes', {static: true}) notesElement: ElementRef;

  toggle: string;
  search: string;
  event;
  studentIds: string[];
  language;
  htmlControls = {
    attended: '',
    absence: '',
    present: ``,
    absent: '',
    toolbar: {
      title: ''
    },
    name: ''
  };

  LANGUAGE = {
    spanish: {
      attended: 'Asistió',
      absence: 'Ausente',
      present: ` está presente hoy.`,
      absent: ' está ausente hoy.',
      toolbar: {
        title: 'Calendario'
      },
      name: 'Nombre: '
    },
    english: {
      attended: 'Attended',
      absence: 'Absent',
      present: `'s is present today!`,
      absent: `'s is absent today`,
      toolbar: {
        title: 'Calendar'
      },
      name: 'Name: '
    }
  };

  constructor(
    private route: ActivatedRoute,
    private alertCtrl: AlertController,
    private db: AmaranthusDBProvider,
    private storage: Storage
  ) { }

  ionViewWillEnter() {
    this.timer = 0;
    this.storage.get('language').then(value => {
      if (value) {
        this.language = value;
      } else {
        this.language = 'english';
      }
      this.htmlControls = this.LANGUAGE[this.language];
    });
    this.event = this.route.snapshot.paramMap.get('event');
    if (!this.event) {
      this.event = '';
    }
    try {
      this.studentIds = this.route.snapshot.paramMap.get('ids').split(',');
    } catch (error) {
      this.studentIds = [];
    }
    this.getStudentsRecords(this.date);
  }

  showNotes(id) {
    if (this.toggle) {
      this.toggle = '';
    } else {
      this.toggle = id;
      setTimeout(() => {
        this.notesElement.nativeElement.focus();
      }, 0);
    }
  }

  addNotes(opts: { id: string; notes: string }) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const newNote = {
        ...opts,
        month: this.date.month,
        day: this.date.day,
        year: this.date.year,
        event: this.event
      };
      this.db.insertNotes(newNote);
      this.updateNotes(opts);
    }, 1000);
  }

  updateNotes(opts: {
    id: string;
    notes: string
  }) {
    const index = this.students.findIndex(student => {
      if (student.id === opts.id) {
        return true;
      }
    });
    this.students[index].notes = opts.notes;
    this.unfilteredStudents[index].notes = opts.notes;
  }

  /**
   *
   * @param {ICalendar} opts
   * Will get all Students queried by today's date.
   */
  getStudentsRecords(opts: ICalendar) {
    const date = {
      ...opts,
      month: opts.month + 1
    };
    this.students = [];
    this.unfilteredStudents = [];
    try {
      const response = this.db.getStudentsRecordsByDate({
        date: date,
        event: this.event
      });
      if (response.success === true) {
        if (this.studentIds.length > 0) {
          let list = [];
          for (const id of this.studentIds) {
            const found = response.data.find(student => id === student.id);
            if (found) {
              list = [...list, found];
            }
          }
          this.students = list;
          this.unfilteredStudents = list;
        } else {
          this.students = response.data;
          this.unfilteredStudents = response.data;
        }
      } else {
        handleError(response.error);
      }
    } catch (error) {
      handleError(error);
    }
  }

  /**
   *
   * @param date
   */
  getDate(date: ICalendar) {
    this.search = '';
    this.date = date;
    const currentDay = date.day;
    const currentYear = date.year;
    if (this.language === 'spanish') {
      const currentMonth = MESESLABELS[date.month];
      const currentWeekDay = DIASHEADER[date.weekDay];
      this.currentDate = `${currentWeekDay} ${currentDay} de ${currentMonth} de ${currentYear}`;
    } else {
      const currentMonth = MONTHSLABELS[date.month];
      const currentWeekDay = WEEKDAYSHEADER[date.weekDay];
      this.currentDate = `${currentWeekDay}, ${currentDay} ${currentMonth}, ${currentYear}`;
    }
    this.getStudentsRecords(date);
  }

  addAttendance(opts: { id: string }) {
    const response = this.db.addAttendance({
      event: this.event,
      date: this.date,
      id: opts.id
    });
    if (response.success === true) {
      this.updateStudentAttendance({
        id: opts.id,
        absence: false,
        attendance: true
      });
      let options;
      if (this.language === 'spanish') {
        options = {
          header: 'Éxito',
          message: '¡El estudiante se marcó presente!',
          buttons: ['Aprobar']
        };
      } else {
        options = {
          header: 'Success!',
          message: 'Student was marked present!',
          buttons: ['OK']
        };
      }
      this.showSimpleAlert(options);
    } else {
      handleError(response.error);
    }
  }

  addAbsence(opts: { id: string }) {
    const response = this.db.addAbsence({
      event: this.event,
      date: this.date,
      id: opts.id
    });
    if (response.success === true) {
      this.updateStudentAttendance({
        id: opts.id,
        absence: true,
        attendance: false
      });
      let options;
      if (this.language === 'spanish') {
        options = {
          header: 'Éxito',
          message: '¡El estudiante se marcó ausente!',
          buttons: ['Aprobar']
        };
      } else {
        options = {
          header: 'Success!',
          message: 'Student was marked absent!',
          buttons: ['OK']
        };
      }
      this.showSimpleAlert(options);
    } else {
      handleError(response.error);
    }
  }

  private updateStudentAttendance(opts: { id: string; absence: boolean; attendance: boolean }) {
    for (let i = 0; i < this.students.length; i++) {
      if (this.students[i].id === opts.id) {
        this.students[i].attendance = opts.attendance;
        this.students[i].absence = opts.absence;
        this.unfilteredStudents[i].attendance = opts.attendance;
        this.unfilteredStudents[i].absence = opts.absence;

      }
    }
  }

  private async showSimpleAlert(options: ISimpleAlertOptions) {
    const alert = await this.alertCtrl.create({
      header: options.header,
      message: options.message,
      buttons: options.buttons
    });
    await alert.present();
  }

  searchStudent() {
    const query = this.search;
    query ? this.filterStudentsList(query) : this.initializeStudentsList();
  }

  private initializeStudentsList() {
    this.students = [...this.unfilteredStudents];
  }

  private filterStudentsList(query: string) {
    const students = <any>this.unfilteredStudents;
    this.students = <any>filterStudentsList({ query: query, students: students });
  }

}
