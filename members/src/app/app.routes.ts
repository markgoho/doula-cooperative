import { Routes } from '@angular/router';
import { EditProfile } from './edit-profile/edit-profile';
import { MyMembership } from './my-membership/my-membership';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'membership' },
  { path: 'membership', component: MyMembership },
  { path: 'profile', component: EditProfile },
  // future routes can go here
];
