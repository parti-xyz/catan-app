import { Component, ViewChild } from '@angular/core';
import { Platform, Content, NavController, NavParams, TextArea, LoadingController } from 'ionic-angular';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { Keyboard } from 'ionic-native';
import { Subscription } from 'rxjs/rx';

import { CommentData } from '../../providers/comment-data';

import { Post } from '../../models/post';
import { Comment } from '../../models/comment';

@Component({
  selector: 'page-post',
  templateUrl: 'post.html'
})
export class PostPage {
  @ViewChild('content') content: Content;
  @ViewChild('inputCommentBody') inputCommentBody: TextArea;

  post: Post;
  commentForm: FormGroup;
  private onShowSubscription: Subscription;
  private onHideSubscription: Subscription;

  constructor(
    public navCtrl: NavController,
    private navParams: NavParams,
    private formBuilder: FormBuilder,
    private platform: Platform,
    private commentData: CommentData,
    private loadingCtrl: LoadingController
  ){
    this.post = navParams.get('post');
    this.commentForm = this.formBuilder.group({
      body: ['', Validators.required]
    });
    if(platform.ready()) {
      Keyboard.disableScroll(true);
      if(this.platform.is('cordova') && this.platform.is('ios')) {
        this.onShowSubscription = Keyboard.onKeyboardShow().subscribe(() => {
          document.body.classList.add('keyboard-is-open');
        });

        this.onHideSubscription = Keyboard.onKeyboardHide().subscribe(() => {
          document.body.classList.remove('keyboard-is-open');
        });
      }
    }
  }

  ngOnDestroy() {
    if (this.onShowSubscription) {
      this.onShowSubscription.unsubscribe();
    }
    if (this.onHideSubscription) {
      this.onHideSubscription.unsubscribe();
    }
  }

  ionViewLoaded() {
  }

  ionViewDidEnter() {
    this.commentForm.controls['body'].setValue(null);
    if(this.navParams.get('needFocusCommentInut')) {
      setTimeout(() => {
        this.inputCommentBody.setFocus();
      }, 50);
    }
  }

  save() {
    console.log("save!!!");
    let loader = this.loadingCtrl.create();
    loader.present();

    let formValue = this.commentForm.value;
    this.commentData.create(this.post, formValue.body)
      .finally(() => {
        loader.dismiss();
      }).subscribe((comment: Comment) => {
        console.log("add comment data!");
        if(!this.post.comments) {
          this.post.comments = [];
        }
        this.post.comments.push(comment);
        this.commentForm.controls['body'].setValue(null);
        this.content.resize();
        setTimeout(() => {
          this.content.scrollToBottom();
        }, 50);
      });
  }

  focusInput(input) {
    input.setFocus();
  }

  post_body_or_title() {
    if(!this.post) {
      return "";
    }

    return this.post.parsed_title || this.post.parsed_body;
  }
}
