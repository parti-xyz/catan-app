import { Component, ViewChild } from '@angular/core';
import { App, NavController, Slides } from 'ionic-angular';
import 'rxjs/add/operator/finally';

import _ from 'lodash';

import { HomePage } from '../../pages/home/home';
import { MyselfData } from '../../providers/myself-data';
import { TagData } from '../../providers/tag-data';
import { PartiData } from '../../providers/parti-data';
import { MemberData } from '../../providers/member-data';
import { Parti } from '../../models/parti';

interface CheckableTag {
  name: string;
  checked: boolean;
}

interface JoinableParti extends Parti {
  pending: boolean;
}

@Component({
  selector: 'page-opening',
  templateUrl: 'opening.html'
})
export class OpeningPage {
  @ViewChild('openingSliders') slider: Slides;

  tags: CheckableTag[];
  parties: JoinableParti[];

  constructor(
    public navCtrl: NavController,
    private app: App,
    public myselfData: MyselfData,
    private tagData: TagData,
    private partiData: PartiData,
    private memberData: MemberData
  ) {}

  ionViewDidLoad() {
    this.tagData.mostUsedOnParties(100).subscribe((tagNames: string[]) => {
      this.tags = _.map(tagNames, (tagName) => <CheckableTag>({ name: tagName, checked: false }));
    });

    this.partiData.all()
      .subscribe((parties: Parti[]) => {
        this.parties = <JoinableParti[]>(parties);
      });
  }

  onClickNext() {
    let lastIndex = 2;
    let index = this.slider.getActiveIndex();
    if(index == lastIndex) {
      this.app.getRootNav().setRoot(HomePage);
    } else {
      this.slider.slideNext(500);
    }
  }

  onClickTag(tag) {
    tag.checked = !tag.checked;

    this.loadParties();
  }

  onClickParti(parti) {
    if(parti.pending) {
      return;
    }

    parti.pending = true;
    if(parti.is_member) {
      this.memberData.cancel(parti)
        .finally(() => {
          parti.pending = false;
        }).subscribe(() => {
          parti.is_member = false;
        });
    } else {
      this.memberData.join(parti)
        .finally(() => {
          parti.pending = false;
        }).subscribe(() => {
          parti.is_member = true;
        });
    }
  }

  loadParties() {
    this.parties = null;
    this.partiData.tagged(_.map(this.tags, (tag) => tag.name))
      .subscribe((parties: Parti[]) => {
        this.parties = <JoinableParti[]>(parties);
      });
  }
}