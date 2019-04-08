import { Component, OnInit } from '@angular/core';
import { IProductGet, ISimpleAlertOptions } from '../common/models';
import { EmailComposer } from '@ionic-native/email-composer/ngx';
import { LoadingController, Platform, AlertController } from '@ionic/angular';
import { AppPurchaseProvider } from '../services/app-purchase/app-purchase';
import { Market } from '@ionic-native/market/ngx';
import { stateAndroid } from '../common/constants';
import { Storage } from '@ionic/storage';
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  products: IProductGet[] = [];
  noProducts = true;
  isIos: boolean;
  isAndroid: boolean;
  bought: boolean;

  constructor(
    public emailComposer: EmailComposer,
    public loading: LoadingController,
    public storage: Storage,
    public platform: Platform,
    public iap: AppPurchaseProvider,
    public alertCtrl: AlertController,
    public market: Market
  ) { }

  ngOnInit() {
    if (this.platform.is('ios')) {
      this.isIos = true;
    } else if (this.platform.is('android')) {
      this.isAndroid = true;
    }
    this.storage.get('boughtMasterKey').then(boughtMasterKey => {
      if (boughtMasterKey) {
        this.bought = true;
      } else {
        this.bought = false;
      }
    });
      if (this.platform.is('cordova')) {
        // this.storage.get('products').then(products => {
        //   if (products) {
        //     this.products = products;
        //     this.noProducts = false;
        //   } else {
        //     this.getProducts();
        //   }
        // });
        this.getProducts();
      }
  }

  openMarketPage() {
    if (this.platform.is('android')) {
      this.market.open('xyz.attendancelog.amaranthus');
    }
    if (this.platform.is('ios')) {
      this.market.open('id1366019347');
    }
  }

  sendEmail(message: string) {
    const body = `
    <p>Hi,</p>
    <p>For issues:</p>
    <p>[Phone Model]</p>
    <p>Issue: [Write a summary of my issue!]</p>
    <br>
    <p>For Feedback:</p>
    <p>[Phone Model]</p>
    <p>Idea: [Summary of my awesome idea!]</p>
    <p>Description: ${message}</p>
    `;
    let email = {
      to: 'attendancelogtracker@gmail.com',
      subject: 'Attendance Log: Browser',
      body: body,
      isHtml: true
    };
    if (this.platform.is('cordova')) {
      if (this.platform.is('android')) {
        email = {
          ...email,
          subject: 'Attendance Log: Android'
        };
      }
      if (this.platform.is('ios')) {
        email = {
          ...email,
          subject: 'Attendance Log: IPhone'
        };
      }
    }
    this.emailComposer.open(email);
  }

  getProducts() {
    this.iap.getProducts().then(products => {
      this.noProducts = false;
      this.products = [...products];
      this.storage.set('products', products);
    })
      .catch(err => {
        this.showSimpleAlert({
          buttons: ['OK'],
          header: 'Error!',
          message: err
        }).then(_ => this.noProducts = false);
      });
  }

  async restorePurchases() {
    const loading = await this.loading.create({
      message: 'Restoring Purchases!'
    });
    loading.present();
    if (this.platform.is('android')) {
      this.iap.restoreAndroidPurchase().then(products => {
        products.forEach(product => {
          const receipt = JSON.parse(product.receipt);
          if (product.productId === 'master.key' && stateAndroid[receipt.purchaseState] === ('ACTIVE' || 0)) {
            this.storage.set('boughtMasterKey', true);
            this.bought = true;
            const options: ISimpleAlertOptions = {
              header: 'Information',
              message: 'Restored the purchase!',
              buttons: ['OK']
            };
            this.showSimpleAlert(options);
          }
        });
        loading.dismiss();
      })
        .catch(_ => {
          this.showSimpleAlert({ buttons: ['OK'], header: 'Error!', message: `No receipts available in the App Store!` });
          loading.dismiss();
        });
    } else if (this.platform.is('ios')) {
      this.iap.restoreiOSPurchase().then(receipt => {
        if (receipt) {
          const options: ISimpleAlertOptions = {
            header: 'Information',
            message: 'Restored the purchase!',
            buttons: ['OK']
          };
          this.storage.set('boughtMasterKey', true);
          this.bought = true;
          this.showSimpleAlert(options);
        } else {
          const options: ISimpleAlertOptions = {
            header: 'Information',
            message: `No receipts available in the App Store!`,
            buttons: ['OK']
          };
          this.showSimpleAlert(options);
        }
        loading.dismiss();
      })
        .catch(_ => {
          this.showSimpleAlert({ buttons: ['OK'], header: 'Error!', message: 'No receipts available in the App Store!' });
          loading.dismiss();
        });
    }
  }

  async buyProduct(opts: { productTitle: string; productId: string }) {
    const loading = await this.loading.create({
      message: `Buying ${opts.productTitle}!`
    });
    loading.present();
    this.iap.buy(opts.productId).then(product => {
      this.showSimpleAlert({
        buttons: ['OK'],
        header: 'Success!',
        message: `${product.transactionId} was successfully bought.`
      });
      this.storage.set('boughtMasterKey', true);
      this.bought = true;
      loading.dismiss();
    })
      .catch(err => {
        this.showSimpleAlert({
          buttons: ['OK'],
          header: 'Error!',
          message: err
        });
        loading.dismiss();
      });
  }

  public async showSimpleAlert(options: ISimpleAlertOptions) {
    const alert = await this.alertCtrl.create({
      header: options.header,
      message: options.message,
      buttons: options.buttons
    });
    alert.present();
  }
}
