import { Injectable } from '@angular/core';
import { Http, Headers, RequestOptions, Response } from '@angular/http';
import { Platform } from 'ionic-angular';
import { NativeStorage } from 'ionic-native';

import { Observable } from 'rxjs/Observable';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/finally';
import 'rxjs/add/observable/from';

import { AuthToken } from '../models/auth-token';
import { Myself } from '../models/myself';
import { PartiEnvironment } from '../config/constant';

@Injectable()
export class MyselfData {
  STORAGE_REFERENCE_HAS_SIGNED_IN = 'MyselfData_hasSignedIn';
  STORAGE_REFERENCE_NICKNAME = 'MyselfData_nickname';
  STORAGE_REFERENCE_ID = 'MyselfData_id';
  STORAGE_REFERENCE_IMAGE_URL = 'MyselfData_imageUrl';
  STORAGE_REFERENCE_ACCESS_TOKEN = 'MyselfData_accessToken';
  STORAGE_REFERENCE_REFRESH_TOKEN = 'MyselfData_refreshToken';

  STORAGE_REFERENCE_LAST_MESSAGE_ID = 'MyselfData_lastMessageId';

  public accessToken: string;
  public refreshToken: string;
  public nickname: string;
  public id: number;
  public imageUrl: string;

  public lastMessageId: number;
  private syncedStorage: boolean = false;
  private _hasSignedIn: boolean = false;

  constructor(
    private platform: Platform,
    private http: Http,
    private partiEnvironment: PartiEnvironment
  ) {}

  ready() {
    return this.platform.ready().then(() => {
      Promise.all([
        NativeStorage.getItem(this.STORAGE_REFERENCE_HAS_SIGNED_IN),
        NativeStorage.getItem(this.STORAGE_REFERENCE_NICKNAME),
        NativeStorage.getItem(this.STORAGE_REFERENCE_ID),
        NativeStorage.getItem(this.STORAGE_REFERENCE_IMAGE_URL),
        NativeStorage.getItem(this.STORAGE_REFERENCE_ACCESS_TOKEN),
        NativeStorage.getItem(this.STORAGE_REFERENCE_REFRESH_TOKEN),
        NativeStorage.getItem(this.STORAGE_REFERENCE_LAST_MESSAGE_ID)
      ]).then(values => {
        this._hasSignedIn = values[0];
        this.nickname = values[1];
        this.id = values[2];
        this.imageUrl = values[3];
        this.accessToken = values[4];
        this.refreshToken = values[5];
        this.lastMessageId = values[6];
        this.syncedStorage = true;
        if(this._hasSignedIn && this.accessToken && this.id && this.refreshToken) {
          console.log("MyselfData : 이미 로그인");
        } else {
          this.clearMyselfData();
          console.log("MyselfData : 로그아웃");
        }
        return Promise.resolve();
      }).catch(error => {
        this.clearMyselfData();
        console.log("MyselfData : 로그인 정보 없음");
        console.log(JSON.stringify(error));
        this._hasSignedIn = false;
        return Promise.resolve();
      });
    });
  }

  auth(snsProvider: string, snsAccessToken: string,  snsSecretToken: string = null, nickname: string = null, email: string = null) {
    let tokenRequestBody = {
      provider: snsProvider,
      assertion: snsAccessToken,
      secret: snsSecretToken,
      grant_type: 'assertion',
      client_id: this.partiEnvironment.apiClientId,
      client_secret: this.partiEnvironment.apiClientSecret,
    };
    if(!!snsSecretToken) {
      tokenRequestBody['secret'] = snsSecretToken;
    }
    if(!!nickname || !!email) {
      tokenRequestBody['user'] = {};
      if(!!nickname) {
        tokenRequestBody['user']['nickname'] = nickname;
      }
      if(!!email) {
        tokenRequestBody['user']['email'] = email;
      }
    }

    return this.http.post(`${this.partiEnvironment.apiBaseUrl}/oauth/token`, tokenRequestBody)
      .map(res => <AuthToken>res.json())
      .mergeMap(response => {
        return this.storeTokenData(response.access_token, response.refresh_token);
      }).mergeMap(accessToken => {
        let meRequestOptions = new RequestOptions({headers: new Headers({ 'Authorization': `Bearer ${accessToken}` })});
        return this.http.get(`${this.partiEnvironment.apiBaseUrl}/api/v1/users/me`, meRequestOptions)
                   .map(res => <Myself>res.json().user);
      }).mergeMap(myself => {
        return this.storeMyselfData(myself);
      }).mergeMap(() => {
        return this.storeHasSignedIn(true);
      }).catch((error) => {
        console.log("MyselfData#auth : " + error);
        return this.storeHasSignedIn(false)
          .map(() => {
            if (error instanceof Response && error.status == 401) {
              if("need_nickname" == error.json()["error"] || "need_nickname_and_email" == error.json()["error"]) {
                console.log("MyselfData#auth : new user!");
                let signUpError = new NeedToSignUpError();
                signUpError.snsProvider = snsProvider;
                signUpError.snsAccessToken = snsAccessToken;
                signUpError.snsSecretToken = snsSecretToken;
                if("need_nickname_and_email" == error.json()["error"]) {
                  signUpError.needEmail = true;
                }

                throw signUpError;
              } else if("duplicate_nickname" == error.json()["error"]) {
                console.log("MyselfData#auth : duplicated nickname!");
                throw new DuplicateNicknameError();
              }
            }
            throw error
          });
      });
  }

  storeTokenData(accessToken, refreshToken) {
    this.syncedStorage = false;
    return Observable.from(Promise.all([
      NativeStorage.setItem(this.STORAGE_REFERENCE_ACCESS_TOKEN, accessToken),
      NativeStorage.setItem(this.STORAGE_REFERENCE_REFRESH_TOKEN, refreshToken)])
      .then(values => {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        return accessToken
      })).finally(() => {
        this.syncedStorage = true;
      });
  }

  storeMyselfData(myself: Myself) {
    this.syncedStorage = false;
    return Observable.from(Promise.all([
      NativeStorage.setItem(this.STORAGE_REFERENCE_ID, myself.id),
      NativeStorage.setItem(this.STORAGE_REFERENCE_NICKNAME, myself.nickname),
      NativeStorage.setItem(this.STORAGE_REFERENCE_IMAGE_URL, myself.image_url),
      NativeStorage.setItem(this.STORAGE_REFERENCE_LAST_MESSAGE_ID, 0
        )])
      .then(values => {
        this.id = myself.id;
        this.nickname = myself.nickname;
        this.imageUrl = myself.image_url;
      })).finally(() => {
        this.syncedStorage = true;
      });
  }

  clearMyselfData() {
    this.syncedStorage = false;
    return Observable.from(Promise.all([
        NativeStorage.remove(this.STORAGE_REFERENCE_HAS_SIGNED_IN),
        NativeStorage.remove(this.STORAGE_REFERENCE_NICKNAME),
        NativeStorage.remove(this.STORAGE_REFERENCE_ID),
        NativeStorage.remove(this.STORAGE_REFERENCE_ACCESS_TOKEN),
        NativeStorage.remove(this.STORAGE_REFERENCE_REFRESH_TOKEN),
        NativeStorage.remove(this.STORAGE_REFERENCE_LAST_MESSAGE_ID)
      ]).then(values => {
        this.accessToken = null;
        this.refreshToken = null;
        this.nickname = null;
        this.id = -1;
        this.imageUrl = null;
        this._hasSignedIn = false;
        this.lastMessageId = 0;
        return this._hasSignedIn;
      })).finally(() => {
        this.syncedStorage = true;
      });
  }

  storeHasSignedIn(hasSignedIn) {
    return Observable.from(NativeStorage.setItem(this.STORAGE_REFERENCE_HAS_SIGNED_IN, hasSignedIn)
      .then(value => {
        this._hasSignedIn = value;
        return value;
      }));
  }

  // Return a promise. This method sould be called after platform reday
  hasSignedIn() {
    if(this.syncedStorage) {
      return Promise.resolve(this._hasSignedIn);
    }
    return NativeStorage.getItem(this.STORAGE_REFERENCE_HAS_SIGNED_IN)
      .catch(error => {
        return Promise.resolve(false);
      });
  }

  refresh(): Observable<boolean> {
    this._hasSignedIn = false;
    let tokenRequestBody = {
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
      client_id: this.partiEnvironment.apiClientId,
      client_secret: this.partiEnvironment.apiClientSecret
    };
    console.log("MyselfData#refresh : Starting refresh-token");
    return this.http.post(`${this.partiEnvironment.apiBaseUrl}/oauth/token`, tokenRequestBody)
      .map(res => <AuthToken>res.json())
      .mergeMap(authToken => {
        return this.storeTokenData(authToken.access_token, authToken.refresh_token);
      }).mergeMap(accessToken => {
        let meRequestOptions = new RequestOptions({headers: new Headers({ 'Authorization': `Bearer ${accessToken}` })});
        return this.http.get(`${this.partiEnvironment.apiBaseUrl}/api/v1/users/me`, meRequestOptions)
                   .map(res => <Myself>res.json().user);
      }).mergeMap(myself => {
        return this.storeMyselfData(myself);
      }).map(() => {
        console.log("MyselfData#refresh : OK");
        this._hasSignedIn = true;
        return this._hasSignedIn;
      }).catch((error, source) => {
        console.log("MyselfData#refresh : " + error);
        if(error && error.status  == 401) {
          return this.clearMyselfData().finally(() => {
          });
        } else {
          throw error;
        }
      });
  }

  signOut() {
    let tokenRequestBody = {
      token: this.accessToken,
      client_id: this.partiEnvironment.apiClientId,
      client_secret: this.partiEnvironment.apiClientSecret
    };
    return this.http.post(`${this.partiEnvironment.apiBaseUrl}/oauth/revoke`, tokenRequestBody)
      .mergeMap(response => {
        return this.clearMyselfData().finally(() => {
        });
      }).catch((error) => {
        console.log("MyselfData#signOut : " + error);
        throw error;
      });
  }

  asModel(): Myself {
    return <Myself>{id: this.id, nickname: this.nickname, image_url: this.imageUrl};
  }

  getLastMessageId(): number {
    return this.lastMessageId;
  }

  setLastMessageId(messageId: number) {
    return Observable.from(NativeStorage.setItem(this.STORAGE_REFERENCE_LAST_MESSAGE_ID, messageId)
      .then(value => {
        console.log('STORAGE_REFERENCE_LAST_MESSAGE_ID');
        console.log(value);
        this.lastMessageId = value;
        return value;
      }));
  }
}

export class NeedToSignUpError extends Error {
  public snsProvider: string;
  public snsAccessToken: string;
  public snsSecretToken: string;
  public needEmail: boolean = false;

  constructor() {
    super("가입해야 합니다.");
    this.name = "NeedToSignUpError";
    this.stack = (<any> new Error()).stack;
  }
}

export class DuplicateNicknameError extends Error {
}
