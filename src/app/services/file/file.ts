import { FileOpener } from '@ionic-native/file-opener/ngx';
import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { IResponse } from 'src/app/common/models';
import { IWriteOptions, File } from '@ionic-native/file/ngx';

declare const fs;
declare const process;

@Injectable({
  providedIn: 'root'
})
export class FileProvider {

  constructor(
    private fileOpener: FileOpener,
    private file: File,
    private platform: Platform
  ) { }

  /**
   *
   *
   * @param {{
   *     fileName: string,
   *     text: any,
   *     type: string
   *   }} opts
   * @returns {Promise<IResponse<any>>}
   * @memberof FileProvider
   */
  exportFile(opts: {
    fileName: string,
    text: any,
    type: string
  }): Promise<IResponse<any>> {
    return new Promise((resolve, reject) => {
      if (this.platform.is('ios')) {
        this.writeToIOS(opts)
          .then(response => resolve(response))
          .catch(error => reject(error));
      }
      if (this.platform.is('android')) {
        this.writeToAndroid(opts)
          .then(response => {
            return resolve(response);
          })
          .catch(error => reject(error));
      }
      if (this.platform.is('desktop')) {
        this.writeToDesktop(opts)
          .then(response => {
            return resolve(response);
          })
          .catch(error => reject(error));
      }
    });
  }

  /**
   *
   * @param {{ fileName: string, text: any, type: string }} opts
   * @returns {Promise<IResponse<any>>}
   * @memberof FileProvider
   *    */
  writeToDesktop(opts: { fileName: string, text: any, type: string }): Promise<IResponse<string>> {

    return new Promise((resolve, reject) => {
      let path = ``;
      if (navigator.userAgent.match('Macintosh')) {
        path = `${process.env.HOME}/Documents/${opts.fileName}`;
      } else if (navigator.userAgent.match('Windows')) {
        path = `${process.env.USERPROFILE}\\Documents\\${opts.fileName}`;
      }
      fs.writeFile(path, opts.text, {}, (err) => {
        if (err) {
          reject(err);
        }
        resolve({
          success: true,
          data: `The file has been saved on under Documents/${opts.fileName}`,
          dateStamp: new Date().toString(),
          error: null,
        });
      });
    });
  }


  /**
   *
   *
   * @param {{ fileName: string, text: any, type: string }} opts
   * @returns {Promise<IResponse<any>>}
   * @memberof FileProvider
   */
  writeToAndroid(opts: { fileName: string, text: any, type: string }): Promise<IResponse<any>> {
    const options: IWriteOptions = {
      replace: true
    };
    const path = this.file.externalRootDirectory;
    const outDirectory = 'AttendanceLog';
    return new Promise((resolve, reject) => {
      this.file.checkDir(path, outDirectory)
        .then(() => {
          this.file.writeFile(path + outDirectory, opts.fileName, opts.text, options)
            .then(() => {
              this.toFileOpener({
                ...opts,
                path: path,
                directory: outDirectory
              })
                .then(data => resolve(data))
                .catch(error => reject(error));
            })
            .catch(_ => reject('There was an error reading the directory, please try again!'));
        })
        .catch(() => {
          this.file.createDir(path, outDirectory, true)
            .then(directory => {
              this.file.writeFile(path + directory.name, opts.fileName, opts.text, options)
                .then(() => {
                  this.toFileOpener({
                    ...opts,
                    path: path,
                    directory: directory.name
                  })
                    .then(data => resolve(data))
                    .catch(error => reject(error));
                })
                .catch(_ => reject('There was an error when the file was created, please try again!'));
            })
            .catch(_ => reject('There was an error creating the directory, please try again!'));
        });
    });
  }

  /**
   *
   *
   * @param {{ fileName: string, text: any, type: string }} opts
   * @returns {Promise<IResponse<any>>}
   * @memberof FileProvider
   */
  writeToIOS(opts: { fileName: string, text: any, type: string }): Promise<IResponse<any>> {
    const options: IWriteOptions = {
      replace: true
    };
    const path = this.file.dataDirectory;
    const outDirectory = 'AttendanceLog';
    return new Promise((resolve, reject) => {
      this.file.checkDir(path, outDirectory)
        .then(() => {
          this.file.writeFile(path + outDirectory, opts.fileName, opts.text, options)
            .then(() => {
              this.toFileOpener({
                ...opts,
                path: path,
                directory: outDirectory
              })
                .then(data => resolve(data))
                .catch(error => reject(error));
            })
            .catch(() => reject('There was an error reading the directory, please try again!'));
        })
        .catch(() => {
          this.file.createDir(path, outDirectory, true)
            .then(directory => {
              this.file.writeFile(path + directory.name, opts.fileName, opts.text, options)
                .then(() => {
                  this.toFileOpener({
                    ...opts,
                    path: path,
                    directory: outDirectory
                  })
                    .then(data => resolve(data))
                    .catch(error => reject(error));
                })
                .catch(error => reject(JSON.stringify(error)));
            })
            .catch(_ => reject('There was an error creating the directory, please try again!'));
        });
    });
  }

  /**
   *
   *
   * @param {{ fileName: string, text: any, type: string, path, directory }} opts
   * @returns {Promise<IResponse<any>>}
   * @memberof FileProvider
   */
  toFileOpener(opts: { fileName: string, text: any, type: string, path, directory }): Promise<IResponse<any>> {
    return new Promise((resolve, reject) => {
      let response: IResponse<string> = {
        success: false,
        error: '',
        data: ''
      };
      const path = `${opts.path}${opts.directory}/${opts.fileName}`;
      if (opts.type === 'xlsx') {
        response = {
          ...response,
          success: true,
          data: `${opts.fileName} was exported successfully to the folder ${opts.path}${opts.directory} in your device!`
        };
        this.fileOpener.open(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .then(() => resolve(response))
          .catch(_ => reject(
            `${opts.fileName} was exported successfully to the folder ${opts.path}${opts.directory} in your device
             but there was an error opening the file, please try again!`
          ));
      }
      if (opts.type === 'txt') {
        response = {
          ...response,
          success: true,
          data: `${opts.fileName} was exported successfully to the folder ${opts.path}${opts.directory} in your device!`
        };
        this.fileOpener.open(path, 'text/plain')
          .then(() => resolve(response))
          .catch(_ => reject(
            `${opts.fileName} was exported successfully to the folder ${opts.path}${opts.directory} in your device
             but there was an error opening the file, please try again!`
          ));
      }
      if (opts.type === 'csv') {
        response = {
          ...response,
          success: true,
          data: `${opts.fileName} was exported successfully to the folder ${opts.path}${opts.directory} in your device!`
        };
        this.fileOpener.open(path, 'text/csv')
          .then(() => resolve(response))
          .catch(_ => reject(
            `${opts.fileName} was exported successfully to the folder ${opts.path}${opts.directory} in your device
             but there was an error opening the file, please try again!`
          ));
      }
    });
  }
}
