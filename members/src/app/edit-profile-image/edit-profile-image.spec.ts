import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditProfileImage } from './edit-profile-image';

describe('EditProfileImage', () => {
  let component: EditProfileImage;
  let fixture: ComponentFixture<EditProfileImage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditProfileImage],
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileImage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
