import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Facebook, TwitterConnect } from 'ionic-native';
import { App, Platform, LoadingController, AlertController, ToastController } from 'ionic-angular';

import 'rxjs/add/operator/toPromise';

import { TabsPage } from '../../pages/tabs/tabs';
import { SignUpPage } from '../../pages/sign-up/sign-up';

import { PartiEnvironment } from '../../config/constant';
import { MyselfData, NeedToSignUpError } from '../../providers/myself-data';
import { PushService } from '../../providers/push-service';

@Component({
  selector: 'page-sign-in',
  templateUrl: 'sign-in.html'
})
export class SignInPage {
  constructor(
    public navCtrl: NavController,
    public partiEnvironment: PartiEnvironment,
    public loadingCtrl: LoadingController,
    private platform: Platform,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private pushService: PushService,
    private app: App,
    private myselfData: MyselfData
  ) {}

  facebookSignIn() {
    this.signIn(() => {
      return Facebook.login(["email"])
      .then((result) => {
        return Facebook.getAccessToken()
      }).then((snsAccessToken) => {
        return this.myselfData.auth('facebook', snsAccessToken).toPromise();
      });
    });
  }

  twitterSignIn() {
    this.signIn(() => {
      return TwitterConnect.login().then((response) =>{
        return response;
      }).then((snsTokens) => {
        return this.myselfData.auth('twitter', snsTokens.token, snsTokens.secret).toPromise();
      })
    });
  }

  signIn(authPromise) {
    let loading = this.loadingCtrl.create({
      content: '로그인 중...'
    });

    loading.present();
    this.platform.ready().then(() => {
      authPromise().then((hasSignedIn) => {
        loading.dismiss().then(() => {
          if(hasSignedIn) {
            this.pushService.subscribe();
            this.app.getRootNav().setRoot(TabsPage);
          }
        });
      }).catch((error) => {
        loading.dismiss().then(() => {
          if(error instanceof NeedToSignUpError) {
            this.app.getRootNav().setRoot(SignUpPage, {
              snsProvider: error.snsProvider,
              snsAccessToken: error.snsAccessToken,
              snsSecretToken: error.snsSecretToken,
              needEmail:  error.needEmail
            });
          } else {
            console.log("SignInPage#login : " + error);
            if(error !== "User cancelled authentication." || error !== "User cancelled.") {
              let toast = this.toastCtrl.create({
                message: '아! 뭔가 잘못되었습니다.',
                duration: 3000
              });
              toast.present();
            }
          }
        });
      });
    });
  }

}
