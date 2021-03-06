import { AppPurchaseProvider } from './../services/app-purchase/app-purchase';
import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, ModalController, NavController, LoadingController, Platform } from '@ionic/angular';
import { CreatePage } from 'src/app/create/create.page';
import { IStudent, ICalendar, ISimpleAlertOptions, IRecord } from 'src/app/common/models';
import { AmaranthusDBProvider } from 'src/app/services/amaranthus-db/amaranthus-db';
import { handleError } from 'src/app/common/handleError';
import { sortStudentsbyId, sortStudentsName, filterStudentsList } from 'src/app/common/search';
import { Storage } from '@ionic/storage';
import { stateAndroid } from '../common/constants';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  students: (IStudent & { attendance, absence })[];
  private unfilteredStudents: (IStudent & IRecord)[];
  selectOptions;
  filterOptions: string[];
  date: ICalendar;
  toggle;
  timer;
  homeURL = '/tabs/tabs/home';
  appStart: boolean;
  htmlControls = {
    toolbar: {
      title: '',
      buttons: {
        event: '',
        add: ''
      }
    },
    sort: '',
    filter: '',
    class: '',
    phone: '',
    attended: '',
    absence: '',
    profile: '',
    present: ``,
    absent: ``,
    search: ''
  };

  language = '';

  LANGUAGE = {
    english: {
      toolbar: {
        title: 'Daily Attendance',
        buttons: {
          event: 'Events',
          add: 'Add'
        }
      },
      sort: 'Sort by: ',
      filter: 'Filter by: ',
      class: 'Class: ',
      phone: 'Phone: ',
      attended: 'Attended',
      absence: 'Absent',
      profile: 'Profile',
      present: `'s present today!`,
      absent: `'s absent today!`,
      search: 'Search by ID or Name'
    },
    spanish: {
      toolbar: {
        title: 'Asistencia Diaria',
        buttons: {
          event: 'Evento',
          add: 'Crear'
        }
      },
      sort: 'Ordenar por: ',
      filter: 'Filtrar por: ',
      class: 'Clase: ',
      phone: 'Teléfono: ',
      attended: 'Asistió',
      absence: 'Ausente',
      profile: 'Perfil',
      present: ` está presente hoy.`,
      absent: ` está ausente hoy.`,
      search: 'Buscar por ID o Nombre'
    }
  };
  @ViewChild('notes', {static: true}) notesElement;
  @ViewChild('sort', {static: true}) sortElement;
  @ViewChild('filter', {static: true}) filterElement;

  constructor(
    private alertCtrl: AlertController,
    private db: AmaranthusDBProvider,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    // private loadingController: LoadingController,
    private storage: Storage,
    private platform: Platform,
    private iap: AppPurchaseProvider
  ) { }

  ngOnInit() {
    const bought = 'boughtMasterKey';
    this.storage.set(bought, false);
    if (this.platform.is('android')) {
      this.iap.restoreAndroidPurchase().then(products => {
        products.forEach(product => {
          const receipt = JSON.parse(product.receipt);
          if (product.productId === 'master.key' && stateAndroid[receipt.purchaseState] === ('ACTIVE' || 0)) {
            this.storage.set(bought, true);
            const options: ISimpleAlertOptions = {
              header: 'Information',
              message: 'Restored the purchase!',
              buttons: ['OK']
            };
            this.showSimpleAlert(options);
          }
        });
      });
    }
    const currentDate = new Date();
    this.date = {
      month: currentDate.getMonth(),
      day: currentDate.getDate(),
      year: currentDate.getFullYear()
    };
    this.students = [];
    this.unfilteredStudents = [];
    this.getStudents();
    if (this.platform.is('desktop') && navigator.userAgent.match('Windows')) {
      this.storage.set('boughtMasterKey', true);
    }
  }

  ionViewWillEnter() {
    this.timer = 0;
    this.storage.get('language').then(value => {
      if (value) {
        this.language = value;
      } else {
        this.language = 'english';
      }
      this.htmlControls = this.LANGUAGE[this.language];
      if (this.language === 'spanish') {
        this.selectOptions = ['ID', 'Nombre', 'Ninguno'];
        this.sortElement.value = 'Ninguno';
        this.filterElement.value = 'Activo';
      } else {
        this.selectOptions = ['ID', 'Name', 'None'];
        this.sortElement.value = 'None';
        this.filterElement.value = 'Active';
      }
      this.getStudents();
      this.filterOptions = this.getFilterOptions();
    });
  }

  private async getStudents() {
    const date = {
      ...this.date,
      month: this.date.month + 1
    };
    try {
      const studentResponse = this.db.getAllActiveStudents(date);
      if (studentResponse.success === true && studentResponse.data) {
        this.students = studentResponse.data.filter(student => {
          if (student.isActive) {
            return student;
          }
        });
        this.unfilteredStudents = studentResponse.data;
      } else {
        // const loading = await this.loadingController.create();
        // await loading.present();
        const studentTimeout = setTimeout(() => {
          if (this.students.length > 0) {
            // await loading.dismiss();
            this.appStart = true;
            clearTimeout(studentTimeout);
          }
          this.getStudents();
          this.filterOptions = this.getFilterOptions();
        }, 3000);
      }
    } catch (error) { 
      handleError(error);
    }
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
      const currentDate = new Date();
      const newNote = {
        ...opts,
        event: '',
        month: currentDate.getMonth(),
        day: currentDate.getDate(),
        year: currentDate.getFullYear()
      };
      this.db.insertNotes(newNote);
      this.updateNotes(opts);
    }, 1000);
  }

  updateNotes(opts: { id: string; notes: string }) {
    const index = this.students.findIndex(student => {
      if (student.id === opts.id) {
        return true;
      }
    });
    this.students[index].notes = opts.notes;
    this.unfilteredStudents[index].notes = opts.notes;
  }

  getFilterOptions() {
    let options = [];
    const checkIfHaveClass = this.students.filter(student => {
      if (student.class) {
        return true;
      }
    });
    for (const student of checkIfHaveClass) {
      if (options.indexOf(student.class) === -1) {
        options = [...options, student.class];
      }
    }
    if (this.language === 'spanish') {
      options = [...options, 'Activo', 'Inactivo', 'Masculino', 'Femenino', 'No revelado', 'Todos'];
    } else {
      options = [...options, 'Active', 'Not Active', 'Male', 'Female', 'Undisclosed', 'All'];
    }
    return options;
  }

  filterByClass(option: string) {
    let newQuery = [];
    switch (option) {
      case 'Male':
      case 'Female':
      case 'Undisclosed':
        const gender = option.toLowerCase();
        newQuery = this.unfilteredStudents.filter(student => {
          if (student.gender === gender) {
            return student;
          }
        });
        this.students = [...newQuery];
        break;
      case 'Masculino':
        this.filterByClass('Male');
        break;
      case 'Femenino':
        this.filterByClass('Female');
        break;
      case 'No revelado':
        this.filterByClass('Undisclosed');
        break;
      case 'Todos':
        this.filterByClass('All');
        break;
      case 'All':
        this.initializeStudentsList();
        break;
      case 'Activo':
        this.filterByClass('Active');
        break;
      case 'Inactivo':
        this.filterByClass('Not Active');
        break;
      case 'Active':
        newQuery = this.unfilteredStudents.filter(student => {
          if (student.isActive) {
            return student;
          }
        });
        this.students = [...newQuery];
        break;
      case 'Not Active':
        newQuery = this.unfilteredStudents.filter(student => {
          if (!student.isActive) {
            return student;
          }
        });
        this.students = [...newQuery];
        break;
      case 'All':
        this.initializeStudentsList();
        break;
      default:
        newQuery = this.unfilteredStudents.filter(student => {
          if (student.class === option) {
            return student;
          }
        });
        this.students = [...newQuery];
    }
  }

  private initializeStudentsList() {
    this.students = [...this.unfilteredStudents];
  }

  searchStudent(event) {
    const query: string = event.target.value;
    query ? this.filterStudentsList(query) : this.initializeStudentsList();
  }

  sortData(option: string) {
    switch (option) {
      case 'ID':
        this.sortStudentsbyId();
        break;
      case 'Name':
      case 'Nombre':
        this.sortStudentsName();
        break;
      default:
        this.initializeStudentsList();
    }
  }

  private sortStudentsbyId() {
    this.students = <any>sortStudentsbyId(this.students);
  }

  private sortStudentsName() {
    this.students = <any>sortStudentsName(this.students);
  }

  private filterStudentsList(query: string) {
    this.students = <any>filterStudentsList({ query: query, students: this.unfilteredStudents });
  }

  addAttendance(opts: { id: string }) {
    const response = this.db.addAttendance({ date: this.date, id: opts.id });
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
    const response = this.db.addAbsence({ date: this.date, id: opts.id });
    if (response.success === true) {
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
      this.updateStudentAttendance({
        id: opts.id,
        absence: true,
        attendance: false
      });
    } else {
      handleError(response.error);
    }
  }

  private updateStudentAttendance(opts: { id: string; absence: boolean; attendance: boolean }) {
    // const results = this.students.map(student => {
    //   if (student.id === opts.id) {
    //     return {
    //       ...student,
    //       attendance: opts.attendance,
    //       absence: opts.absence
    //     };
    //   } else {
    //     return student;
    //   }
    // });
    // this.unfilteredStudents = [...results];
    // this.students = [...results];
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
    const alert = await this.alertCtrl
      .create({
        header: options.header,
        message: options.message,
        buttons: options.buttons
      });
    alert.present();
  }

  async goToCreate() {
    const modal = await this.modalCtrl.create({
      component: CreatePage
    });
    modal.present();
    modal.onDidDismiss().then(_ => {
      this.getStudents();
      this.filterOptions = this.getFilterOptions();
    });
  }

  goToProfile(id) {
    this.navCtrl.navigateForward(`${this.homeURL}/profile/${id}`);
  }

  goToEvents() {
    this.navCtrl.navigateForward(`${this.homeURL}/events`);
  }
}
