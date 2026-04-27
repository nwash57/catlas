import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-how-to-help',
  imports: [RouterLink],
  templateUrl: './how-to-help.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowToHelp {}
