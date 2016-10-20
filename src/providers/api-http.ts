import { Injectable } from "@angular/core";
import { Http, Headers } from "@angular/http";
import { Events } from 'ionic-angular';
import { RequestOptions, XHRBackend, RequestMethod, Response, RequestOptionsArgs } from '@angular/http';

import { PartiEnvironment } from '../config/constant';
import { MyselfData } from '../providers/myself-data';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';

@Injectable()
export class ApiHttp extends Http {
  constructor(
    backend: XHRBackend,
    defaultOptions: RequestOptions,
    private myselfData: MyselfData,
    private partiEnvironment: PartiEnvironment,
    private events: Events
  ) {
    super(backend, defaultOptions);
  }

  public get(url: string, options?: RequestOptionsArgs): Observable<Response> {
    return this.intercept(RequestMethod.Get, url, null, options);
  }

  public post(url: string, body: string, options?: RequestOptionsArgs): Observable<Response> {
    return this.intercept(RequestMethod.Post, url, body, options);
  }

  public put(url: string, body: string, options?: RequestOptionsArgs): Observable<Response> {
    return this.intercept(RequestMethod.Put, url, body, options);
  }

  public delete(url: string, options?: RequestOptionsArgs): Observable<Response> {
    return this.intercept(RequestMethod.Delete, url, null, options);
  }

  public patch(url: string, body: string, options?: RequestOptionsArgs): Observable<Response> {
    return this.intercept(RequestMethod.Patch, url, body, options);
  }

  public head(url: string, options?: RequestOptionsArgs): Observable<Response> {
    return this.intercept(RequestMethod.Head, url, null, options);
  }

  getRequestOptionArgs(method: RequestMethod, url: string, body?: string, options?: RequestOptionsArgs): RequestOptionsArgs {
    if (options == null) {
      options = new RequestOptions();
    }
    if (options.headers == null) {
      options.headers = new Headers();
    }
    options.headers.append('Authorization', `Bearer ${this.myselfData.accessToken}`);
    options.headers.append('Content-Type', 'application/json');
    options.method = method;
    options.body = body;
    return options;
  }

  intercept(method: RequestMethod, url: string, body?: string, options?: RequestOptionsArgs): Observable<Response> {
    var requestOptions: RequestOptionsArgs = this.getRequestOptionArgs(method, url, body, options);
    let apiUrl = `${this.partiEnvironment.apiBaseUrl}${url}`;

    return super.request(apiUrl, requestOptions).catch((error, source) => {
      if (error && error.status  == 401) {
        return this.myselfData.refresh()
          .mergeMap(succeed => {
            requestOptions = this.getRequestOptionArgs(method, url, body, options);
            return super.request(apiUrl, requestOptions);
          }).catch(error => {
            this.events.publish('user:signout');
            if(this.myselfData.hasSignedIn) {
              return Observable.throw(new Error("Can't refresh the token"));
            } else {
              console.log("ApiHttp#intercept : signout out!");
              return Observable.empty();
            }
          });
      } else {
        return Observable.throw(error);
      }
    });
   }
}
