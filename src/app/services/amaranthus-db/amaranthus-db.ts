import { Injectable } from '@angular/core';
import { IonicStorageAdapter } from './adapter';
import * as Loki from 'lokijs';
import { IStudent, IRecord, IEvent, INote, IResponse, ICalendar } from 'src/app/common/models';
import { trimEvent, trimText } from 'src/app/common/format';
import { handleError } from 'src/app/common/handleError';
import { Storage } from '@ionic/storage';
import { CapacitorFileLokiAdapter } from './capacitor-file-loki-adapter';
import { dateToISO } from 'src/app/common/utils';


const adapter = new Loki.LokiPartitioningAdapter(new CapacitorFileLokiAdapter(), { paging: true });
/**
 * Collections use on db
 */
let studentsColl: Collection<IStudent>;
let recordsColl: Collection<IRecord>;
let eventsColl: Collection<IEvent>;
let notesColl: Collection<INote>;

let studentsColl2: Collection<any>;
let eventsColl2: Collection<any>;
/**
 * Declaration of DB
 */
let amaranthusDB: Loki;

let localDB: Loki;


let students: any[];
let events: any[];
let records: any[];
let notes: any[];


@Injectable({
  providedIn: 'root'
})
export class AmaranthusDBProvider {


  insertTest() {

    const student: IStudent = {
      id: (Math.random() * 100).toString(),
      firstName: 'Esteban',
      lastName: 'Morales',
      address: '123 street  ',
      phoneNumber: '122345667',
      town: 'arroyo',
      state: 'pr',
      picture: './assets/profilePics/default.png',
      gender: 'male',
      fatherName: 'esteban',
      motherName: 'rosa',
      emergencyContactName: 'dom  ',
      emergencyRelationship: 'friend',
      emergencyContactPhoneNumber: '6543',
      isActive: true,
      class: '11-2'
    };
    try {
      studentsColl.insert(student);
    } catch (error) {
      console.error(error);
    }
  }

  constructor(private storage: Storage) {
    students = [];
    events = [];
    records = [];
    notes = [];
    this.init();
  }

  async init() {
    let lokiOptions: Partial<LokiConfigOptions> = {
      autosave: true,
      autoload: true,
      autoloadCallback: this._loadDatabase
    };
    const ionicStorageAdapter = new IonicStorageAdapter();
    lokiOptions.adapter = ionicStorageAdapter;
    amaranthusDB = new Loki('amaranthus.db', lokiOptions);

    localDB = new Loki('amaranthus2.db', {
      autosave: true,
      autoload: true,
      adapter: adapter,
      autoloadCallback: this._loadLocalDatabase2
    });
  }

  deleteInvalidCharacters() {
    studentsColl.findAndRemove({ 'id': { '$containsAny': '/' }, });
    studentsColl.findAndRemove({ 'id': { '$containsAny': '#' } });
    studentsColl.findAndRemove({ 'id': { '$containsAny': '%' } });
  }

  private _loadDatabase() {
    studentsColl = amaranthusDB.getCollection<IStudent>('students');
    recordsColl = amaranthusDB.getCollection<IRecord>('records');
    eventsColl = amaranthusDB.getCollection<IEvent>('events');
    notesColl = amaranthusDB.getCollection<INote>('notes');
    if (!studentsColl) {
      studentsColl = amaranthusDB.addCollection<IStudent>('students');
    }
    if (!recordsColl) {
      recordsColl = amaranthusDB.addCollection<IRecord>('records');
    }
    if (!eventsColl) {
      eventsColl = amaranthusDB.addCollection<IEvent>('events');
    }
    if (!notesColl) {
      notesColl = amaranthusDB.addCollection<INote>('notes');
    }

    let studentView = studentsColl.getDynamicView('students');
    if (!studentView) {
      studentView = studentsColl.addDynamicView('students');
    }
    let recordsView = recordsColl.getDynamicView('records');
    if (!recordsView) {
      recordsView = recordsColl.addDynamicView('records');
    }
    let notesView = notesColl.getDynamicView('notes');
    if (!notesView) {
      notesView = notesColl.addDynamicView('notes');
    }
    let eventsView = eventsColl.getDynamicView('events');
    if (!eventsView) {
      eventsView = eventsColl.addDynamicView('events');
    }

    students = studentView.data({ removeMeta: true });
    records = recordsView.data({ removeMeta: true });
    notes = notesView.data({ removeMeta: true });
    events = eventsView.data({ removeMeta: true });
  }

  private _loadLocalDatabase2() {
    studentsColl2 = localDB.getCollection('students');
    eventsColl2 = localDB.getCollection('events');
    if (!studentsColl2) {
      studentsColl2 = localDB.addCollection('students');
    }
    if (!eventsColl2) {
      eventsColl2 = localDB.addCollection('events');
    }

    if (students.length > 0) {
      students.forEach(studentData => {
        const newStudent = {
          records: new Loki.Collection('records'),
          notes: new Loki.Collection('notes'),
          ...studentData
        };
        if (records.length > 0) {
          records.forEach(recordData => {
            try {
              newStudent.records.insertOne({
                attendance: recordData.attendance,
                date: dateToISO(recordData.year, recordData.month, recordData.day),
                event: recordData.event
              })
            } catch (error) {
              console.error(error);
              newStudent.records.update({
                attendance: recordData.attendance,
                date: dateToISO(recordData.year, recordData.month, recordData.day),
                event: recordData.event
              })
            }
          });
        }
        if (notes.length > 0) {
          notes.forEach(note => {
            try {
              newStudent.notes.insertOne({
                notes: note.notes,
                event: note.event,
                date: dateToISO(note.year, note.month, note.day)
              })
            } catch (error) {
              console.error(error);
              newStudent.notes.update({
                notes: note.notes,
                event: note.event,
                date: dateToISO(note.year, note.month, note.day)
              })
            }

          });
        }
        try {
          const found = studentsColl2.findOne({ id: newStudent.id });
          if (!found) {
            studentsColl2.insert(newStudent);
          } else {
            studentsColl2.update({
              ...found,
              ...newStudent
            });
          }
        } catch (error) {
          console.error(error);
        }
      });
    }
    try {
      if (events.length > 0) {
        events.forEach(event => {
          const studentMembers = [] as IStudent[];
          event.members.forEach(member => {
            const newStudent = studentsColl2.findOne({ id: member.id });
            studentMembers.push(newStudent);
          });
          const newEvent = {
            picture: event.logo,
            name: event.name,
            startDate: new Date(event.startDate).valueOf(),
            students: studentMembers
          }
          try {
            const found = eventsColl2.findOne({ name: newEvent.name });
            if (!found) {
              eventsColl2.insertOne(newEvent);
            } else {
              eventsColl2.update({
                ...found,
                ...newEvent
              });
            }
          } catch (error) {
            console.error(error);
          }
        })
      }
    } catch (error) {
      console.error(error);
    }
  }

  checkIfUserExists(opts: { username: string; password }) {
    let response: IResponse<any> = {
      success: false,
      error: null,
      data: null
    };
    let checkUser = studentsColl.findOne({
      'id': {
        '$eq': opts.username
      },
      'phoneNumber': {
        '$eq': opts.password
      }
    });
    if (!checkUser) {
      const fullName = opts.username.split(' ');
      checkUser = studentsColl.findOne({
        'firstName': {
          '$eq': fullName[0]
        },
        'lastName': {
          '$eq': fullName[1]
        },
        'phoneNumber': {
          '$eq': opts.password
        }
      });
    }
    if (checkUser) {
      response = {
        ...response,
        success: true,
        data: checkUser.firstName
      };
      const currentDate = new Date();
      const date: ICalendar = {
        month: currentDate.getMonth(),
        day: currentDate.getDate(),
        year: currentDate.getFullYear()
      };
      this.addAttendance({ date: date, id: checkUser.id });
    } else {
      response = {
        ...response
      };
    }
    return response;
  }

  getNoteByDate(opts: { date: ICalendar; id: string, event: string }) {
    let response: IResponse<INote> = {
      success: false,
      error: null,
      data: undefined
    };
    const results: any = notesColl.findOne({
      'id': {
        '$eq': opts.id
      },
      'month': {
        '$eq': opts.date.month
      },
      'year': {
        '$eq': opts.date.year
      },
      'day': {
        '$eq': opts.date.day
      },
      'event': {
        '$eq': opts.event
      }
    });
    if (results) {
      response = {
        ...response,
        success: true,
        data: results
      };
      return response;
    } else {
      response = {
        ...response,
        error: 'Error retrieving notes. Please try again!',
        data: null
      };
      return response;
    }
  }

  getNoteById(id: string) {
    let response: IResponse<INote> = {
      success: false,
      error: null,
      data: undefined
    };
    const results = notesColl.findOne({
      'id': id
    });
    if (results) {
      response = {
        ...response,
        success: true,
        data: results
      };
      return response;
    } else {
      response = {
        ...response,
        error: 'Error retrieving notes. Please try again!',
        data: null
      };
      return response;
    }
  }

  getAllNotesById(id: string) {
    let response: IResponse<INote[]> = {
      success: false,
      error: null,
      data: undefined
    };
    const results = notesColl
      .chain()
      .find({
        'id': id
      })
      .simplesort('day')
      .simplesort('month')
      .simplesort('year')
      .data();
    if (results) {
      response = {
        ...response,
        success: true,
        data: [...results]
      };
      return response;
    } else {
      response = {
        ...response,
        error: 'Error retrieving notes. Please try again!',
        data: null
      };
      return response;
    }
  }

  getNotes() {
    return notesColl.data;
  }

  insertNotes(note: INote) {
    let response: IResponse<null> = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      const results: any = notesColl.findOne({
        'id': {
          '$eq': note.id
        },
        'month': {
          '$eq': note.month
        },
        'year': {
          '$eq': note.year
        },
        'day': {
          '$eq': note.day
        },
        'event': note.event
      });
      if (!results) {
        notesColl.insert(note);
      } else {
        const newNote = {
          ...results,
          ...note
        };
        notesColl.update(newNote);
      }
      response = { ...response, success: true };
      return response;
    } catch (error) {
      response = { ...response, error: error };
      return response;
    }
  }

  studentExists(id): boolean {
    const student = studentsColl.findOne({
      id: id
    });
    if (student) {
      return true;
    } else {
      return false;
    }
  }

  updateEventMembers(opts: { name: string, member: { id: any } }) {
    const results = eventsColl.findOne({
      name: opts.name
    });
    const members = results.members.filter(member => member.id !== opts.member.id);
    const event = {
      ...results,
      members: members
    };
    eventsColl.update(event);
  }

  insertEvent(event: IEvent) {
    let response: IResponse<null> = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      const formattedEvent = trimEvent(event);
      const exists = eventsColl.findOne({
        name: event.name
      });
      if (!exists) {
        eventsColl.insert(formattedEvent);
        response = { ...response, success: true };
      }
      return response;
    } catch (error) {
      response = { ...response, error: error };
      return response;
    }
  }

  updateEvent(event) {
    const response = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      const results: any = eventsColl.get(event.$loki);
      if (results) {
        eventsColl.update(event);
        return {
          ...response,
          success: true
        };
      } else {
        throw new Error('User doesn\'t exist on Database');
      }
    } catch (error) {
      return {
        ...response,
        error: error
      };
    }
  }

  removeEvent(event: IEvent) {
    const response: IResponse<null> = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      const results = eventsColl.get(event['$loki']);
      eventsColl.remove(results);
      const records = recordsColl.find({
        'event': results.name
      });
      records.forEach(record => recordsColl.remove(record));
      return { ...response, success: true };
    } catch (error) {
      return { ...response, error: error };
    }
  }

  getEvents() {
    let response: IResponse<IEvent[]> = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      const results: any = eventsColl
        .chain()
        .simplesort('startDate', true)
        .data();
      if (!results) {
        throw new Error(`Couldn't get any results`);
      }
      response = {
        ...response,
        success: true,
        data: results
      };
      return response;
    } catch (error) {
      response = {
        ...response,
        error: error
      };
      return response;
    }
  }

  getEvent(id) {
    let response: IResponse<IEvent> = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      const results = eventsColl.get(id);
      if (results) {
        response = {
          ...response,
          success: true,
          data: results
        };
      } else {
        throw new Error(`Couldn't find any members participating in this event.`);
      }
      return response;
    } catch (error) {
      response = {
        ...response,
        error: error
      };
      return response;
    }
  }

  checkIfStudentExists(opts: { id: string }) {
    try {
      const results = studentsColl.findOne({
        'id': {
          '$eq': opts.id
        }
      });
      if (results) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      if (!studentsColl) {
        return error;
      }
    }
  }

  insertStudentIntoDB(student: IStudent): IResponse<null> {
    let response: IResponse<null> = {
      success: false,
      error: null,
      data: undefined
    };
    const value = this.checkIfStudentExists({ id: student.id });
    try {
      if (value === false) {
        const formattedStudent = trimText(student);
        studentsColl.insert(formattedStudent);
        response = {
          ...response,
          success: true
        };
      } else {
        response = {
          ...response,
          error: 'User already exists in the database'
        };
      }
      return response;
    } catch (error) {
      response = {
        ...response,
        error: error
      };
      return response;
    }
  }

  insertStudent(student: IStudent): Promise<IResponse<null>> {
    let response: IResponse<null> = {
      success: false,
      error: null,
      data: undefined
    };
    return new Promise((resolve, reject) => {
      if (studentsColl.data.length > 9) {
        this.storage.get('boughtMasterKey').then(boughtMasterKey => {
          if (boughtMasterKey === true) {
            response = {
              ...response,
              ...this.insertStudentIntoDB(student)
            };
            if (response.success) {
              resolve(response);
            }
            reject(response);
          } else {
            response = {
              success: false,
              error: `Reached the limit of 10 persons in database. If you want to get rid of this limit please consider buying the app!`,
              data: null
            };
            resolve(response);
          }
        });
      } else {
        response = {
          ...response,
          ...this.insertStudentIntoDB(student)
        };
        if (response.success) {
          resolve(response);
        }
        reject(response);
      }
    });
  }

  updateStudent(student: IStudent): IResponse<null> {
    try {
      let results: any = studentsColl.findOne({
        'id': {
          '$eq': student.id
        }
      });
      const formattedStudent = trimText(student);
      results = {
        ...results,
        ...formattedStudent
      };
      studentsColl.update(results);
      return {
        success: true,
        error: null,
        data: null
      };
    } catch (error) {
      if (!studentsColl) {
        return error;
      }
    }
  }

  removeStudent(student: IStudent): IResponse<null> {
    try {
      const students = studentsColl.findOne({
        'id': {
          '$eq': student.id
        }
      });
      studentsColl.remove(students);

      const records = recordsColl.find({
        'id': {
          '$eq': student.id
        }
      });
      if (records['length']) {
        records.forEach(record => {
          recordsColl.remove(record);
        });
      }

      const notes = notesColl.find({
        'id': {
          '$eq': student.id
        }
      });
      if (notes['length']) {
        notes.forEach(note => {
          notesColl.remove(note);
        });
      }

      return {
        success: true,
        error: null,
        data: null
      };
    } catch (error) {
      if (!studentsColl) {
        return error;
      }
      if (!recordsColl) {
        return error;
      }
      if (!notesColl) {
        return error;
      }
    }
  }

  addAbsence(opts: { date: ICalendar; id: string; event?: string }): IResponse<null> {
    let response;
    if (opts['event']) {
      response = this.insertOrUpdateRecord({
        ...opts,
        date: {
          ...opts.date,
          month: opts.date.month + 1
        },
        attendance: false,
        absence: true,
        event: opts.event
      });
    } else {
      response = this.insertOrUpdateRecord({
        ...opts,
        date: {
          ...opts.date,
          month: opts.date.month + 1
        },
        attendance: false,
        absence: true
      });
    }
    return response;
  }

  addAttendance(opts: { date: ICalendar; id: string; event?: string }): IResponse<null> {
    let response;
    if (opts['event']) {
      response = this.insertOrUpdateRecord({
        ...opts,
        date: {
          ...opts.date,
          month: opts.date.month + 1
        },
        attendance: true,
        absence: false,
        event: opts.event
      });
    } else {
      response = this.insertOrUpdateRecord({
        ...opts,
        date: {
          ...opts.date,
          month: opts.date.month + 1
        },
        attendance: true,
        absence: false
      });
    }
    return response;
  }

  insertOrUpdateRecord(opts: { attendance: boolean; absence: boolean; date: ICalendar; id: string; event?: string }) {
    let response: IResponse<null> = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      let record: IRecord = {
        id: opts.id,
        month: opts.date.month,
        year: opts.date.year,
        day: opts.date.day,
        attendance: opts.attendance,
        absence: opts.absence,
        event: ''
      };
      let results;
      if (opts['event']) {
        record = {
          ...record,
          event: opts.event
        };
        results = recordsColl.findOne({
          'id': {
            '$eq': record.id
          },
          'month': {
            '$eq': record.month
          },
          'year': {
            '$eq': record.year
          },
          'day': {
            '$eq': record.day
          },
          'event': {
            '$eq': opts.event
          }
        });
      } else if (opts.hasOwnProperty('event')) {
        results = recordsColl.findOne({
          'id': {
            '$eq': record.id
          },
          'month': {
            '$eq': record.month
          },
          'year': {
            '$eq': record.year
          },
          'day': {
            '$eq': record.day
          },
          'event': {
            '$eq': ''
          }
        });
      } else {
        results = recordsColl.findOne({
          'id': {
            '$eq': record.id
          },
          'month': {
            '$eq': record.month
          },
          'year': {
            '$eq': record.year
          },
          'day': {
            '$eq': record.day
          }
        });
      }
      if (results) {
        const foundRecord = {
          ...results,
          ...record
        };
        recordsColl.update(foundRecord);
      } else {
        const newRecord = {
          ...record
        };
        recordsColl.insert(newRecord);
      }
      response = {
        ...response,
        success: true,
        error: null,
        data: null
      };
      return response;
    } catch (error) {
      if (recordsColl) {
        response = {
          ...response,
          error: error || null
        };
        return response;
      }
    }
  }

  getStudentById(student: IStudent): IResponse<IStudent> {
    let response: IResponse<IStudent> = {
      success: false,
      error: null,
      data: undefined
    };
    try {
      const results = studentsColl.findOne({
        'id': {
          '$eq': student.id
        }
      });
      if (results) {
        response = {
          ...response,
          success: true,
          error: null,
          data: results
          // data: studentFound
        };
      }
      return response;
    } catch (error) {
      // tslint:disable-next-line: no-shadowed-variable
      const response = {
        success: false,
        error: error,
        data: undefined
      };
      if (studentsColl) {
        return response;
      }
    }
  }

  getQueriedRecords(opts: { event?: string; query: string; date?: ICalendar }): IResponse<IRecord[]> {
    switch (opts.query) {
      case 'Date':
        return this.getQueriedRecordsByDate(<any>opts);
      default:
        const date: ICalendar = {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          day: null
        };
        let options: any = {
          date: date,
          event: ''
        };
        if (opts['event']) {
          options = {
            ...options,
            event: opts.event
          };
        }
        try {
          return this.getAllStudentsRecords(options);
        } catch (error) {
          return error;
        }
    }
  }

  getStudentsRecordsByDate(opts: { date: ICalendar; event?: string }): IResponse<IRecord[]> {
    let response = {
      success: true,
      error: null,
      data: [],
      event: null
    };
    try {
      const students = studentsColl.find({
        'isActive': {
          '$eq': true
        }
      });
      let studentRecord;
      let record;
      students.map((student: IStudent) => {
        studentRecord = null;
        record = null;
        if (opts['event']) {
          record = recordsColl.findOne({
            'id': {
              '$eq': student.id
            },
            'year': {
              '$eq': opts.date.year
            },
            'month': {
              '$eq': opts.date.month
            },
            'day': {
              '$eq': opts.date.day
            },
            'event': {
              '$eq': opts.event
            }
          });
        } else if (opts.hasOwnProperty('event')) {
          record = recordsColl.findOne({
            'id': {
              '$eq': student.id
            },
            'year': {
              '$eq': opts.date.year
            },
            'month': {
              '$eq': opts.date.month
            },
            'day': {
              '$eq': opts.date.day
            },
            'event': {
              '$eq': ''
            }
          });
        } else {
          record = recordsColl.findOne({
            'id': {
              '$eq': student.id
            },
            'year': {
              '$eq': opts.date.year
            },
            'month': {
              '$eq': opts.date.month
            },
            'day': {
              '$eq': opts.date.day
            }
          });
        }
        const noteDate = {
          ...opts.date,
          month: opts.date.month - 1
        };
        const noteResponse = this.getNoteByDate({
          id: student.id,
          date: noteDate,
          event: opts.event
        });
        if (noteResponse.success) {
          studentRecord = { notes: noteResponse.data.notes };
        } else {
          studentRecord = { notes: '' };
        }
        if (record) {
          if (student.id === record.id) {
            studentRecord = {
              ...studentRecord,
              firstName: student.firstName,
              lastName: student.lastName,
              fullName: `${student.firstName} ${student.lastName}`,
              picture: student.picture,
              attendance: record.attendance,
              absence: record.absence,
              id: student.id
            };
            response = {
              ...response,
              data: [...response.data, studentRecord]
            };
          }
        } else {
          studentRecord = {
            ...studentRecord,
            firstName: student.firstName,
            lastName: student.lastName,
            fullName: `${student.firstName} ${student.lastName}`,
            picture: student.picture,
            attendance: false,
            absence: false,
            id: student.id
          };
          response = {
            ...response,
            data: [...response.data, studentRecord]
          };
        }
      });
      return response;
    } catch (error) {
      if (studentsColl) {
        return error;
      }
      if (recordsColl) {
        return error;
      }
    }
  }

  getAllStudentsRecords(opts: { event?: string; date: ICalendar }): IResponse<IRecord[]> {
    let response = {
      success: true,
      error: null,
      data: []
    };
    let attendance;
    let absence;
    try {
      const students = studentsColl.find({
        'isActive': {
          '$eq': true
        }
      });
      students.map((student: IStudent) => {
        attendance = 0;
        absence = 0;
        let records;
        if (!opts.date.day) {
          if (opts['event']) {
            records = recordsColl.find({
              'id': {
                '$eq': student.id
              },
              'year': {
                '$eq': opts.date.year
              },
              'month': {
                '$eq': opts.date.month
              },
              'event': {
                '$eq': opts.event
              }
            });
          } else if (opts.hasOwnProperty('event')) {
            records = recordsColl.find({
              'id': {
                '$eq': student.id
              },
              'year': {
                '$eq': opts.date.year
              },
              'month': {
                '$eq': opts.date.month
              },
              'event': {
                '$eq': ''
              }
            });
          } else {
            records = recordsColl.find({
              'id': {
                '$eq': student.id
              },
              'year': {
                '$eq': opts.date.year
              },
              'month': {
                '$eq': opts.date.month
              }
            });
          }
        } else {
          if (opts['event']) {
            records = recordsColl.find({
              'id': {
                '$eq': student.id
              },
              'year': {
                '$eq': opts.date.year
              },
              'month': {
                '$eq': opts.date.month
              },
              'day': {
                '$eq': opts.date.day
              },
              'event': {
                '$eq': opts.event
              }
            });
          } else if (opts.hasOwnProperty('event')) {
            records = recordsColl.find({
              'id': {
                '$eq': student.id
              },
              'year': {
                '$eq': opts.date.year
              },
              'month': {
                '$eq': opts.date.month
              },
              'day': {
                '$eq': opts.date.day
              },
              'event': {
                '$eq': ''
              }
            });
          } else {
            records = recordsColl.find({
              'id': {
                '$eq': student.id
              },
              'year': {
                '$eq': opts.date.year
              },
              'month': {
                '$eq': opts.date.month
              },
              'day': {
                '$eq': opts.date.day
              },
            });
          }
        }
        if (records) {
          records.map((record: IRecord) => {
            if (opts.date.day) {
              if (record.attendance === true) {
                attendance = 'x';
                absence = 'o';
              }
              if (record.absence === true) {
                absence = 'x';
                attendance = 'o';
              }
            } else {
              if (record.attendance === true) {
                attendance++;
              }
              if (record.absence === true) {
                absence++;
              }
            }
          });
          let percent = null;
          if (!opts.date.day) {
            percent = 0;
          }
          if ((attendance + absence !== 0)) {
            percent = ((100 * attendance) / (attendance + absence)).toFixed(2);
          }
          if (percent) {
            response = {
              ...response,
              data: [
                ...response.data,
                {
                  id: student.id,
                  fullName: `${student.firstName} ${student.lastName}`,
                  attendance: attendance,
                  percent: percent,
                  absence: absence,
                  picture: student.picture
                }
              ]
            };
          } else {
            response = {
              ...response,
              data: [
                ...response.data,
                {
                  id: student.id,
                  fullName: `${student.firstName} ${student.lastName}`,
                  attendance: attendance,
                  absence: absence,
                  picture: student.picture
                }
              ]
            };
          }
        }
      });
      return response;
    } catch (error) {
      handleError(error);
      response = {
        ...response,
        error: error
      };
      return response;
    }
  }

  getAllStudents(event?: boolean): IResponse<IStudent[]> {
    let response: IResponse<IStudent[]> = {
      success: false,
      error: null,
      data: []
    };
    try {
      let students;
      if (event) {
        students = studentsColl.find({
          'isActive': {
            '$eq': true
          }
        });
      } else {
        students = studentsColl.data;
      }
      response = {
        ...response,
        success: true,
        data: [...students]
      };
      return response;
    } catch (error) {
      if (!studentsColl) {
        response.error = error;
        return response;
      }
    }
  }

  getQueriedRecordsByDate(opts: { event?: string; date: ICalendar }): IResponse<IRecord[]> {
    try {
      return this.getAllStudentsRecords(opts);
    } catch (error) {
      return error;
    }
  }

  /**
   *
   * @param date
   */
  getAllActiveStudents(date: ICalendar): IResponse<any[]> {
    try {
      // const students = studentsColl.find({
      //   'isActive': {
      //     '$eq': true
      //   }
      // }); // Do not delete!
      this.deleteInvalidCharacters();
      const students = studentsColl.data; // Return all the students records
      let record: IRecord;
      const results = students.map(student => {
        record = {
          ...this.getQueriedRecordsByCurrentDate({
            studentId: student.id,
            year: date.year,
            day: date.day,
            month: date.month
          })
        };
        const note = this.getNoteByDate({
          id: student.id,
          event: '',
          date: {
            ...date,
            month: date.month - 1
          }
        });
        let newStudent = {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          initial: student.initial,
          class: student.class,
          phoneNumber: student.phoneNumber,
          picture: student.picture,
          gender: student.gender,
          attendance: false,
          absence: false,
          notes: null,
          isActive: student.isActive // Added on Jun 9th 2019
        };
        if (record != null && record.id === student.id) {
          newStudent = {
            ...newStudent,
            attendance: record.attendance,
            absence: record.absence
          };
        }
        if (note.success) {
          newStudent = {
            ...newStudent,
            notes: note.data.notes
          };
        }
        return newStudent;
      }); // got results
      return {
        success: true,
        error: null,
        data: results
      };
    } catch (error) {
      const response = {
        success: false,
        error: error,
        data: undefined,
        dataStamp: new Date().toString()
      };
      if (!studentsColl) {
        return response;
      }
    }
  }

  getQueriedRecordsByCurrentDate(opts: { event?: string; studentId: string; day: number; year: number; month: number }): IRecord {
    let response: IRecord;
    try {
      let recordQuery;
      if (opts['event']) {
        recordQuery = recordsColl.findOne({
          'id': {
            '$eq': opts.studentId
          },
          'year': {
            '$eq': opts.year
          },
          'day': {
            '$eq': opts.day
          },
          'month': {
            '$eq': opts.month
          },
          'event': {
            '$eq': opts.event
          }
        });
      } else if (opts.hasOwnProperty('event')) {
        recordQuery = recordsColl.findOne({
          'id': {
            '$eq': opts.studentId
          },
          'year': {
            '$eq': opts.year
          },
          'day': {
            '$eq': opts.day
          },
          'month': {
            '$eq': opts.month
          },
          'event': {
            '$eq': ''
          }
        });
      } else {
        recordQuery = recordsColl.findOne({
          'id': {
            '$eq': opts.studentId
          },
          'year': {
            '$eq': opts.year
          },
          'day': {
            '$eq': opts.day
          },
          'month': {
            '$eq': opts.month
          }
        });
      }
      if (recordQuery) {
        response = recordQuery;
        return response;
      }
      return null;
    } catch (error) {
      if (recordsColl) {
        setTimeout(() => this.getQueriedRecordsByCurrentDate(opts), 5000);
      } else {
        return null;
      }
    }
  }
}
