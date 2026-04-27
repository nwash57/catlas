import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-why-tnr-works',
  imports: [RouterLink],
  templateUrl: './why-tnr-works.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhyTnrWorks {}
