import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-how-to-start',
  imports: [RouterLink],
  templateUrl: './how-to-start.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowToStart {}
