<template>
    <div class="team">
        <div class="controls-row flex-between">
            <div class="flex">
                <Calendar
                    :sessionStorageKey="sessionStorageKey"
                    class="controls-row__item"
                    @change="onCalendarChange"
                />

                <UserSelect class="controls-row__item" @change="onUsersChange" />

                <ProjectSelect class="controls-row__item" @change="onProjectsChange" />

                <TimezonePicker :value="timezone" class="controls-row__item" @onTimezoneChange="onTimezoneChange" />
            </div>

            <div class="flex">
                <router-link
                    v-if="$can('viewManualTime', 'dashboard')"
                    class="controls-row__item"
                    to="/time-intervals/new"
                >
                    <at-button class="controls-row__btn" icon="icon-edit">{{ $t('control.add_time') }}</at-button>
                </router-link>

                <ExportDropdown
                    class="export controls-row__item controls-row__btn"
                    position="left"
                    trigger="hover"
                    @export="onExport"
                />
            </div>
        </div>

        <div class="at-container">
            <div class="at-container__inner">
                <div class="row">
                    <div class="col-8 col-lg-6">
                        <TeamSidebar
                            :sort="sort"
                            :sortDir="sortDir"
                            :users="graphUsers"
                            class="sidebar"
                            @sort="onSort"
                        />
                    </div>

                    <div class="col-16 col-lg-18">
                        <TeamDayGraph
                            v-if="type === 'day'"
                            :users="graphUsers"
                            class="graph"
                            @selectedIntervals="onSelectedIntervals"
                        />
                        <TeamTableGraph
                            v-else
                            :end="end"
                            :start="start"
                            :timePerDay="timePerDay"
                            :users="graphUsers"
                            class="graph"
                        />
                    </div>

                    <TimeIntervalEdit
                        v-if="selectedIntervals.length"
                        :intervals="selectedIntervals"
                        @close="clearIntervals"
                        @edit="load"
                        @remove="onBulkRemove"
                    />
                </div>
                <preloader v-if="isDataLoading" :is-transparent="true" class="team__loader" />
            </div>
        </div>
    </div>
</template>

<script>
    import moment from 'moment';
    import 'moment-timezone';
    import throttle from 'lodash/throttle';
    import { mapMutations, mapGetters } from 'vuex';
    import Calendar from '@/components/Calendar';
    import UserSelect from '@/components/UserSelect';
    import ProjectSelect from '@/components/ProjectSelect';
    import TeamSidebar from '../../components/TeamSidebar';
    import TeamDayGraph from '../../components/TeamDayGraph';
    import TeamTableGraph from '../../components/TeamTableGraph';
    import TimezonePicker from '@/components/TimezonePicker';
    import DashboardReportService from '_internal/Dashboard/services/dashboard.service';
    import ProjectService from '@/services/resource/project.service';
    import { getDateToday, getEndOfDayInTimezone, getStartOfDayInTimezone } from '@/utils/time';
    import ExportDropdown from '@/components/ExportDropdown';
    import TimeIntervalEdit from '../../components/TimeIntervalEdit';
    import cloneDeep from 'lodash/cloneDeep';
    import Preloader from '@/components/Preloader';

    const updateInterval = 60 * 1000;

    export default {
        name: 'Team',
        components: {
            Calendar,
            UserSelect,
            ProjectSelect,
            TeamSidebar,
            TeamDayGraph,
            TeamTableGraph,
            TimezonePicker,
            ExportDropdown,
            TimeIntervalEdit,
            Preloader,
        },
        data() {
            const today = this.getDateToday();
            const sessionStorageKey = 'amazingcat.session.storage.team';

            return {
                type: 'day',
                start: today,
                end: today,
                userIDs: [],
                projectIDs: [],
                sort: localStorage.getItem('team.sort') || 'user',
                sortDir: localStorage.getItem('team.sort-dir') || 'asc',
                projectService: new ProjectService(),
                reportService: new DashboardReportService(),
                showExportModal: false,
                selectedIntervals: [],
                sessionStorageKey: sessionStorageKey,
                isDataLoading: false,
            };
        },
        async created() {
            localStorage['dashboard.tab'] = 'team';

            await this.load();
            this.updateHandle = setInterval(() => this.load(false), updateInterval);
        },
        beforeDestroy() {
            clearInterval(this.updateHandle);
            this.service.unloadIntervals();
        },
        computed: {
            ...mapGetters('dashboard', ['intervals', 'timePerDay', 'users', 'timezone', 'service']),
            graphUsers() {
                const { worked } = this;

                return this.users
                    .filter(user => this.userIDs.includes(user.id))
                    .sort((a, b) => {
                        let order = 0;
                        if (this.sort === 'user') {
                            const aName = a.full_name.toUpperCase();
                            const bName = b.full_name.toUpperCase();
                            order = aName.localeCompare(bName);
                        } else if (this.sort === 'worked') {
                            const aWorked = worked[a.id] || 0;
                            const bWorked = worked[b.id] || 0;
                            order = aWorked - bWorked;
                        }

                        return this.sortDir === 'asc' ? order : -order;
                    });
            },
        },
        methods: {
            getDateToday,
            getStartOfDayInTimezone,
            getEndOfDayInTimezone,
            ...mapMutations({
                setTimezone: 'dashboard/setTimezone',
            }),
            load: throttle(async function (withLoadingIndicator = true) {
                this.isDataLoading = withLoadingIndicator;
                if (!this.userIDs.length || !this.projectIDs.length) {
                    this.isDataLoading = false;

                    return;
                }

                const startAt = this.getStartOfDayInTimezone(this.start, this.timezone);
                const endAt = this.getEndOfDayInTimezone(this.end, this.timezone);

                await this.service.load(this.userIDs, this.projectIDs, startAt, endAt);

                this.isDataLoading = false;
            }, 1000),
            onCalendarChange({ type, start, end }) {
                this.type = type;
                this.start = start;
                this.end = end;

                this.service.unloadIntervals();

                this.load();
            },
            onUsersChange(userIDs) {
                this.userIDs = [...userIDs];

                this.load();
            },
            onProjectsChange(projectIDs) {
                this.projectIDs = [...projectIDs];

                this.load();
            },
            onTimezoneChange(timezone) {
                this.setTimezone(timezone);
            },
            onSort(column) {
                if (column === this.sort) {
                    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sort = column;
                    // Sort users ascending and time descending by default
                    this.sortDir = column === 'user' ? 'asc' : 'desc';
                }

                localStorage['team.sort'] = this.sort;
                localStorage['team.sort-dir'] = this.sortDir;
            },
            async onExport(format) {
                const { data } = await this.reportService.downloadReport(
                    this.start,
                    moment.utc(this.end).add(1, 'day').format('YYYY-MM-DD'),
                    this.userIDs,
                    this.projectIDs,
                    format,
                );

                window.open(data.data.url, '_blank');
            },
            onSelectedIntervals(event) {
                this.selectedIntervals = event ? [event] : [];
            },
            onBulkRemove(intervals) {
                const totalIntervals = cloneDeep(this.intervals);
                intervals.forEach(interval => {
                    const userIntervals = cloneDeep(totalIntervals[interval.user_id]).filter(
                        userInterval => interval.id !== userInterval.id,
                    );
                    const deletedDuration = moment(interval.end_at).diff(interval.start_at, 'seconds');
                    userIntervals.duration -= deletedDuration;

                    totalIntervals[interval.user_id] = userIntervals;
                });
                this.$store.commit('dashboard/setIntervals', totalIntervals);

                this.clearIntervals();
            },
            clearIntervals() {
                this.selectedIntervals = [];
            },

            // for send invites to new users
            async getModalInvite() {
                let modal;
                try {
                    modal = await this.$Modal.prompt({
                        title: this.$t('invite.label'),
                        content: this.$t('invite.content'),
                    });
                } catch {
                    return;
                }

                if (!modal.value) {
                    this.$Message.error(this.$t('invite.message.error'));
                    return;
                }

                const emails = modal.value.split(',');

                // eslint-disable-next-line no-useless-escape
                const regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
                const validation = {
                    isError: false,
                    emails: [],
                };

                for (let i = 0; i < emails.length; i++) {
                    let email = emails[i].replace(' ', '');
                    if (regex.exec(email) == null) {
                        validation.isError = true;
                        validation.emails.push(email);
                    }
                }

                if (!validation.isError) {
                    this.reportService.sendInvites({ emails }).then(({ data }) => {
                        this.$Message.success('Success');
                    });
                } else {
                    this.$Message.error(this.$t('invite.message.valid') + validation.emails);
                }
            },
        },
        watch: {
            timezone() {
                this.service.unloadIntervals();
                this.load();
            },
        },
    };
</script>

<style lang="scss" scoped>
    .at-container {
        &__inner {
            position: relative;
        }
    }

    .team__loader {
        z-index: 0;
        border-radius: 20px;

        &::v-deep {
            align-items: baseline;

            .lds-ellipsis {
                position: sticky;
                top: 25px;
            }
        }
    }

    .timeline-type {
        margin-left: 10px;
        border-radius: 5px;

        .at-btn:first-child {
            border-radius: 5px 0 0 5px;
        }

        .at-btn:last-child {
            border-radius: 0 5px 5px 0;
        }

        &-btn {
            border: 1px solid #eeeef5;
            color: #b1b1be;
            font-size: 15px;
            font-weight: 500;
            height: 40px;

            &.active {
                color: #ffffff;
                background: #2e2ef9;
            }
        }
    }

    .export {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 40px;

        &::v-deep .at-btn__text {
            color: #2e2ef9;
            font-size: 25px;
        }
    }

    .button-invite {
        color: #618fea;
    }
</style>
