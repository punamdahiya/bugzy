import React from "react";
import styles from "./Uplift.scss";
import {BugList} from "../BugList/BugList";
import {Loader} from "../Loader/Loader";

import {runQuery} from "../../lib/utils";
import {BUGZILLA_TRIAGE_COMPONENTS} from "../../../config/project_settings";

const columns = ["id", "summary", "last_change_time", "priority"];

export class Uplift extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      loaded: false,
      bugs: []
    };
  }

  async componentWillMount() {
    const trackingField = `cf_tracking_firefox${this.props.prevRelease}`;
    const statusField = `cf_status_firefox${this.props.prevRelease}`;
    const statusNightly = `cf_status_firefox${this.props.release}`;
    const prevRelease = this.props.prevRelease;
    function getFlagQuery(type) {
      return {
        include_fields: columns.concat([trackingField, statusField, statusNightly]),
        component: BUGZILLA_TRIAGE_COMPONENTS,
        target_milestone: ["---", `firefox ${prevRelease + 1}`],
        order: "changeddate DESC",
        custom: {"flagtypes.name": {substring: `approval-mozilla-beta${type}`}}
      };
    }
    const {bugs: upliftRequested} = await runQuery(getFlagQuery("?"));
    const {bugs: upliftDenied} = await runQuery(getFlagQuery("-"));
    const {bugs: upliftComplete} = await runQuery(getFlagQuery("+"));
    const betakey = `cf_tracking_firefox${prevRelease}`;
    const {bugs: tracking} = await runQuery({
      include_fields: columns.concat([trackingField, statusField, statusNightly]),
      component: BUGZILLA_TRIAGE_COMPONENTS,
      order: "changeddate DESC",
      custom: {
        [betakey]: {anyexact: ["?", "+", "blocking"]},
        "flagtypes.name": {notsubstring: `approval-mozilla-beta`}
      }
    });
    this.setState({
      loaded: true,
      bugs: {
        tracking,
        upliftRequested,
        upliftApproved: upliftComplete.filter(b => b.cf_tracking_beta === "+" && !(["verified", "fixed"].includes(b.cf_status_beta))),
        upliftDenied: upliftDenied.filter(b => b.cf_tracking_beta === "+" && !(["verified", "fixed"].includes(b.cf_status_beta))),
        upliftComplete: upliftComplete.filter(b => b.cf_tracking_beta === "+" && ["verified", "fixed"].includes(b.cf_status_beta))
      }
    });
  }

  renderContent() {
    const displayColumns = [...columns, "cf_status_nightly", "cf_status_beta"];
    return (<React.Fragment>
      <h2>Tracking for uplift with no patch yet</h2>
      <p>These bugs have been flagged for uplift but do not have a request open on a patch.</p>
      <BugList bulkEdit={true} tags={true} bugs={this.state.bugs.tracking} columns={displayColumns} />
      <h2>Requested</h2>
      <p>These bugs have a request for uplift open on a patch.</p>
      <BugList bulkEdit={true} tags={true} bugs={this.state.bugs.upliftRequested} columns={displayColumns} />
      <h2>Denied</h2>
      <p>These bugs have a patch that was denied for uplift.</p>
      <BugList bulkEdit={true} tags={true} bugs={this.state.bugs.upliftDenied} columns={displayColumns} />
      <h2>Approved</h2>
      <p>These bugs have a patch that was approved for uplift.</p>
      <BugList bulkEdit={true} tags={true} bugs={this.state.bugs.upliftApproved} columns={displayColumns} />
      <h2>Landed</h2>
      <p>These bugs have been merged to beta.</p>
      <BugList bulkEdit={true} tags={true} bugs={this.state.bugs.upliftComplete} columns={displayColumns} />
    </React.Fragment>);
  }

  render() {
    return (<div className={styles.container}>
      <h1>Uplift to Firefox {this.props.prevRelease}</h1>
      {this.state.loaded ? this.renderContent() : <Loader />}
    </div>);
  }
}
