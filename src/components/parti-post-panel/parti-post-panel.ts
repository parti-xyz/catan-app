import { Platform } from 'ionic-angular';
import { Component, Input } from '@angular/core';
import { NavController, AlertController, ToastController, ActionSheetController } from 'ionic-angular';
import { InAppBrowser, Transfer, FileOpener, SocialSharing, Facebook, Device, AppAvailability } from 'ionic-native';

import _ from 'lodash';

import 'rxjs/add/operator/finally';

import { LinkSource } from '../../models/link-source';
import { FileSource } from '../../models/file-source';
import { User } from '../../models/user';
import { Post } from '../../models/post';
import { PostPage } from '../../pages/post/post';

import { VotingData } from '../../providers/voting-data';
import { MyselfData } from '../../providers/myself-data';

declare var cordova: any;
declare var KakaoTalk;

@Component({
  selector: 'parti-post-panel',
  templateUrl: 'parti-post-panel.html'
})
export class PartiPostPanelComponent {
  @Input()
  post: Post;

  @Input()
  isCollection: boolean;

  disableVotingButtons: boolean = false;

  constructor(
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private platform: Platform,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private votingData: VotingData,
    private myselfData: MyselfData
  ) {}

  isAgreed() {
    return this.post.poll.my_choice === "agree";
  }

  isDisagreed() {
    return this.post.poll.my_choice === "disagree";
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

  onClickCommentButton() {
    this.navCtrl.push(PostPage, {
      post: this.post,
      needFocusCommentInut: true
    });
  }

  onClickLinkReference(linkSource: LinkSource) {
    this.platform.ready().then(() => {
      let browser = new InAppBrowser(linkSource.url, "_blank", "location=true");
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
          let alert = this.alertCtrl.create({
            title: '오류',
            subTitle: '다운로드 중에 오류가 발생했습니다.',
            buttons: ['확인']
          });
          alert.present();
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

        let antiChoice = (choice == 'agree' ? 'disagree' : 'agree');
        if(!this.isVoted()) {
          this.post.poll.votings_count++;
        } else {
          this.post.poll[`${antiChoice}d_votings_count`]--;
        }

        this.post.poll[`${choice}d_voting_users`].push(this.myselfData.asModel());
        this.post.poll[`${choice}d_votings_count`]++;
        this.post.poll[`${antiChoice}d_voting_users`] = _.reject(this.post.poll[`${antiChoice}d_voting_users`], { id: this.myselfData.id });
        this.post.poll.my_choice = choice;
      });
  }

  onClickVotingUser(user: User) {
    console.log(`user ${user.nickname}`);
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
      let alert = this.alertCtrl.create({
        title: '오류',
        subTitle: '아! 뭔가 잘못되었습니다.',
        buttons: ['확인']
      });
      alert.present();
    }

    let share = this.post.share;
    let actionSheet = this.actionSheetCtrl.create({
      buttons: [{
          text: '페이스북으로 공유',
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
          handler: () => {
            SocialSharing.shareViaTwitter(share.twitter_text, "", share.url)
              .then(successHandler)
              .catch(() => {
                let text = share.twitter_text;
                let tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(share.url)}`
                let browser = new InAppBrowser(tweetUrl, "_blank");
              });
          }
        },{
          text: '카카오톡으로 공유',
          handler: () => {
            var app = null;
            if (Device.device.platform === 'iOS') {
              app = 'kakaolink://';
            } else if (Device.device.platform === 'Android') {
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
          text: '취소',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          }
        }]
    });
    actionSheet.present();
  }
}
