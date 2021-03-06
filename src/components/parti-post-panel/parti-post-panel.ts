import { Component, Input, EventEmitter, Output } from '@angular/core';
import { Platform } from 'ionic-angular';
import { NavController, AlertController, ActionSheetController, ModalController, ToastController } from 'ionic-angular';
import { InAppBrowser, Transfer, FileOpener, SocialSharing, Facebook, Device, AppAvailability, Clipboard } from 'ionic-native';

import _ from 'lodash';

import 'rxjs/add/operator/finally';

import { LinkSource } from '../../models/link-source';
import { FileSource } from '../../models/file-source';
import { User } from '../../models/user';
import { Parti } from '../../models/parti';
import { Post } from '../../models/post';
import { Comment } from '../../models/comment';

import { PostPage } from '../../pages/post/post';
import { PartiHomePage } from '../../pages/parti-home/parti-home';
import { ProfilePage } from '../../pages/profile/profile';
import { MembersPage } from '../../pages/members/members';
import { PartiReadMorePipe } from '../../pipes/parti-read-more-pipe';

import { UpvoteData } from '../../providers/upvote-data';
import { CommentData } from '../../providers/comment-data';
import { VotingData } from '../../providers/voting-data';
import { MyselfData } from '../../providers/myself-data';

declare var cordova: any;
declare var KakaoTalk;

@Component({
  selector: 'parti-post-panel',
  templateUrl: 'parti-post-panel.html'
})
export class PartiPostPanelComponent {
  @Input() post: Post;
  @Input() isCollection: boolean;
  @Input() isPartiHome: boolean;
  @Output() onAddComment = new EventEmitter();

  comments: Comment[] = [];
  lastComment: Comment;
  hasMoreComment: boolean = false;
  isPostUpvoteLoading: boolean = false;
  disableVotingButtons: boolean = false;

  constructor(
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private platform: Platform,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private modalCtrl: ModalController,
    private votingData: VotingData,
    private upvoteData: UpvoteData,
    private myselfData: MyselfData,
    private commentData: CommentData
  ) {}

  ngOnInit() {
    if(!this.isCollection) {
      this.loadComments();
    }
  }

  loadComments(onCompleted: () => void = null) {
    this.commentData.byPost(this.post, this.lastComment)
      .finally(() => {
        if(!!onCompleted) {
          onCompleted();
        }
      })
      .subscribe(pagedComments => {
        this.hasMoreComment = pagedComments.has_more_item;
        if(this.post.latest_comments == null) {
          this.post.latest_comments = [];
        }
        this.post.latest_comments = this.post.latest_comments.concat(pagedComments.items);
        if(!!this.post.latest_comments && this.post.latest_comments.length > 0) {
          this.lastComment = this.post.latest_comments[this.post.latest_comments.length-1];
        }
      });
  }

  isAgreed() {
    return this.post.poll.my_choice === "agree";
  }

  isDisagreed() {
    return this.post.poll.my_choice === "disagree";
  }

  isUnsured() {
    return this.post.poll.my_choice === "unsure";
  }

  isVoted() {
    return !!this.post.poll.my_choice;
  }

  isImage() {
    return this.post.file_reference.file_type.startsWith("image");
  }

  hasComment() {
    return this.post.comments_count > 0;
  }

  hasUpvote() {
    return this.post.upvotes_count > 0;
  }

  hasLatestComment() {
    return this.post.latest_comments.length > 0;
  }

  onClickParti(parti: Parti) {
    this.navCtrl.push(PartiHomePage, { parti: parti });
  }

  onClickPostContent(event) {
    if(PartiReadMorePipe.isMoreButtonEvent(event)) {
      event.preventDefault();
      event.stopPropagation();
      PartiReadMorePipe.extend(event);
      return;
    }
    if(this.isCollection == true) {
      this.navCtrl.push(PostPage, {
        post: this.post
      });
    }
  }

  onClickAddCommentButton(event) {
    let comment = event && event.comment;
    if(this.isCollection == true) {
      this.navCtrl.push(PostPage, {
        post: this.post,
        comment: comment,
        needFocusCommentInut: true
      });
    } else {
      this.onAddComment.emit(event);
    }
  }

  onClickRemoveCommentButton(event) {
    let target_comment = event && event.comment;
    this.commentData.destroy(target_comment)
      .subscribe(() => {
        _.remove(this.post.latest_comments, (comment) => {
          return target_comment.id == comment.id;
        });
        this.post.comments_count--;
      });
  }

  onClickLinkReference(linkSource: LinkSource) {
    this.platform.ready().then(() => {
      new InAppBrowser(linkSource.url, "_blank", "location=true");
    });
  }

  onClickFileReference(fileSource: FileSource) {
    let targetPath;
    if (this.platform.is('ios')) {
      targetPath = cordova.file.documentsDirectory + this.post.id + '/' + fileSource.attachment_filename;
    }
    else if(this.platform.is('android')) {
      targetPath = cordova.file.dataDirectory + this.post.id + '/' + fileSource.attachment_filename;
    }
    else {
      console.log("unsupported platform");
      return;
    }

    this.platform.ready().then(() => {
      const fileTransfer = new Transfer();
      var uri = encodeURI(fileSource.attachment_url);
      fileTransfer.download(uri, targetPath)
        .then(() => {
          let alertSuccess = this.alertCtrl.create({
            title: '다운로드 완료',
            subTitle: `${fileSource.name} 파일을 다운로드 했습니다. \n바로 열어 보시겠습니까?`,
            buttons: [
              {
                text: '취소',
                role: 'cancel',
                handler: data => {
                  console.log('Cancel clicked');
                }
              },
              {
                text: '열기',
                handler: () => {
                  FileOpener.open(targetPath, fileSource.file_type);
                }
              }
             ]
          });

          alertSuccess.present(alertSuccess);
        }).catch((error) => {
          console.log("PartiPostPanelComponent#onClickFileReference : " + JSON.stringify(error));
          let toast = this.toastCtrl.create({
            message: '아! 뭔가 잘못되었습니다.',
            duration: 3000
          });
          toast.present();
        });
    });
  }

  onClickVotingButton(choice: string) {
    if(this.post.poll.my_choice === choice) {
      return;
    }
    this.disableVotingButtons = true;
    this.votingData.choose(this.post.poll.id, choice).finally(() => {
        this.disableVotingButtons = false;
      }).subscribe(() => {
        if(choice === this.post.poll.my_choice) {
          return;
        }
        if(choice == 'unsure') {
          this.post.poll.my_choice = choice;
        }
        else {
          let antiChoice = (choice == 'agree' ? 'disagree' : 'agree');

          if(!this.isVoted()) {
            this.post.poll.votings_count++;
          } else {
            if (this.post.poll.my_choice != 'unsure') {
              this.post.poll[`${antiChoice}d_votings_count`]--;
            }
          }

          this.post.poll[`latest_${antiChoice}d_voting_users`] = _.reject(this.post.poll[`latest_${antiChoice}d_voting_users`], { id: this.myselfData.id });
          this.post.poll[`latest_${choice}d_voting_users`] = _.reject(this.post.poll[`latest_${choice}d_voting_users`], { id: this.myselfData.id });
          this.post.poll[`latest_${choice}d_voting_users`].push(this.myselfData.asModel());
          this.post.poll[`${choice}d_votings_count`]++;
          this.post.poll.my_choice = choice;
        }
      });
  }

  onClickVotingUsers(choice: string) {
    let profileModal = this.modalCtrl.create(MembersPage, { post: this.post, choice: choice, from: 'post-poll' });
    profileModal.present();
  }

  onClickUser(user: User) {
    this.navCtrl.push(ProfilePage, { user: user });
  }

  onClickUpvoteUsers() {
    let profileModal = this.modalCtrl.create(MembersPage, { post: this.post, from: 'post-upvotes' });
    profileModal.present();
  }

  onClickUpvoteButton() {
    this.isPostUpvoteLoading = true;
    if(this.post.is_upvotable) {
      this.upvoteData.create(this.post.id, 'Post')
        .finally(() => {
          this.isPostUpvoteLoading = false;
        })
        .subscribe(() => {
          this.post.is_upvotable = false;
          if(!this.post.latest_upvote_users) {
            this.post.latest_upvote_users = [];
          }
          this.post.latest_upvote_users.unshift(this.myselfData.asModel());
          this.post.upvotes_count++;
        });
    } else {
      this.upvoteData.destroy(this.post.id, 'Post')
        .finally(() => {
          this.isPostUpvoteLoading = false;
        })
        .subscribe(() => {
          this.post.is_upvotable = true;
          _.remove(this.post.latest_upvote_users, (user) => {
            return user.id == this.myselfData.asModel().id;
          });
          this.post.upvotes_count--;
        });
    }
  }

  onClickShare() {
    if(!this.post) {
      return;
    }

    let successHandler = () => {
      let toast = this.toastCtrl.create({
        message: '공유되었습니다.',
        duration: 3000
      });
      toast.present();
    }
    let failHandler = (error) => {
      if(error['errorMessage'] == 'User cancelled dialog') {
        return;
      }
      let toast = this.toastCtrl.create({
        message: '아! 뭔가 잘못되었습니다.',
        duration: 3000
      });
      toast.present();
    }

    let share = this.post.share;
    let actionSheet = this.actionSheetCtrl.create({
      buttons: [{
          text: '페이스북으로 공유',
          cssClass: 'share-facebook',
          handler: () => {
            SocialSharing.shareViaFacebook("", "", share.url)
              .then(successHandler)
              .catch(() => {
                Facebook.showDialog({
                  method: "share",
                  href: share.url
                }).then(successHandler).catch(failHandler);
              });
          }
        },{
          text: '트위터로 공유',
          cssClass: 'share-twitter',
          handler: () => {
            SocialSharing.shareViaTwitter(share.twitter_text, "", share.url)
              .then(successHandler)
              .catch(() => {
                let text = share.twitter_text;
                let tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(share.url)}`
                new InAppBrowser(tweetUrl, "_blank");
              });
          }
        },{
          text: '카카오톡으로 공유',
          cssClass: 'share-kakaotalk',
          handler: () => {
            var app = null;
            if (Device.platform === 'iOS') {
              app = 'kakaolink://';
            } else if (Device.platform === 'Android') {
              app = 'com.kakao.talk';
            }

            AppAvailability.check(app).then(
              (yes: boolean) => {
                console.log(share);
                var data = {
                  text: share.kakaotalk_text,
                  weblink: {
                    url: share.url,
                    text: share.kakaotalk_link_text,
                  },
                  applink: {
                    url: share.url,
                    text: share.kakaotalk_link_text,
                  }
                };
                if(!!share.kakaotalk_image_url && !!share.kakaotalk_image_width && !!share.kakaotalk_image_height) {
                  data["image"] = {
                    src: share.kakaotalk_image_url,
                    width: share.kakaotalk_image_width,
                    height: share.kakaotalk_image_height,
                  };
                }
                data
                KakaoTalk.share(data,
                  (success) => successHandler,
                  (error) => failHandler);
              },
              () => {
                let alert = this.alertCtrl.create({
                  title: '확인',
                  subTitle: `카카오톡 앱이 없습니다.`,
                  buttons: ['확인']
                });
                alert.present();
              }
            );
          }
        },{
          text: '링크 복사',
          cssClass: 'share-url',
          handler: () => {
            Clipboard.copy(share.url);
          }
        },{
          text: '취소',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          }
        }]
    });
    actionSheet.present();
  }

  smart_post_latest_comments() {
    if(this.isCollection) {
      return _.slice(this.post.latest_comments, this.post.latest_comments.length - 2)
    } else {
      return this.post.latest_comments
    }
  }
}
