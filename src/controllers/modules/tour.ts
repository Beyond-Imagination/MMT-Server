// TODO: 에러 처리 로직 구체화
// TODO: 리팩토링
import _ from 'lodash';
import {Request, Response} from "express";
import {validationResult} from "express-validator";

import { success } from "@/helpers";
import {ReqParamsNotMatchError, ContentNotFoundError} from "@/errors";
import {Tour} from "@/types";
import {getDetailCommon, getDetailImage, getDetailInfo, getDetailIntro, getLocationBasedList} from "@/services";

/**
 * 관광지 목록 조회
 * @param req
 * @param res
 */
const index = async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        throw new ReqParamsNotMatchError(errors);
    }

    const { query } = req;

    const locationBasedList = await getLocationBasedList(query as unknown as Tour.Service.GetLocationBasedList.Request);

    const result: Tour.API.GetMany.Result = {
        numOfRows: locationBasedList.numOfRows,
        pageNo: locationBasedList.pageNo,
        totalCount: locationBasedList.totalCount,
        arrange: query.arrange as string,
        items: []
    }

    if (locationBasedList.totalCount == 0) {
        return success(res, result);
    }

    const detailCommonList = await Promise.all(
        locationBasedList.items.item.map(async item =>
            getDetailCommon({
                contentId: item.contentid,
                contentTypeId: item.contenttypeid,
                overviewYN: "Y"
            })
        )
    );

    const mergedList = _.merge(locationBasedList.items, {item: detailCommonList});

    const items = mergedList.item.map(item => {
        return {
            contentId: item.contentid, // 콘텐츠ID
            contentTypeId: item.contenttypeid, // 관광타입(관광지, 숙박 등) ID
            imageUrl: item.firstimage2, // 썸네일 이미지 주소 (약 160\*100 size)
            title: item.title, // 콘텐츠 제목
            overview: item.overview // 콘텐츠 개요
        }
    });

    result.items = items;

    success(res, result);
};

/**
 * 관광지 detail 조회
 * @param req
 * @param res
 */
const show = async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        throw new ReqParamsNotMatchError(errors)
    }

    const { params, query } = req;

    const contentId = +params.id;
    const contentTypeId = +query.contentTypeId as Tour.ContentTypeId;

    const [
        detailIntro,
        detailImageList,
        detailCommon,
        detailInfoList
    ] = await Promise.all([
        getDetailIntro({ contentId, contentTypeId }),
        getDetailImage({ contentId }),
        getDetailCommon({ contentId, contentTypeId, defaultYN: "Y", addrInfoYN: "Y", overviewYN: "Y" }),
        getDetailInfo({ contentId, contentTypeId })
    ]);

    if (detailInfoList.totalCount == 0) {
        throw new ContentNotFoundError();
    }

    const images =
        detailImageList.totalCount != 0
            ? detailImageList.items.item.map(item => {
                return {
                    imgName: item.imgname, // 이미지명
                    originImgUrl: item.originimgurl, // 원본 이미지 URL (약 500\*333 size)
                    smallImgUrl: item.smallimageurl // 썸네일 이미지 URL (약 160\*100 size)
                }
            }) : [];

    const normalInfo = parseDetailCommon(detailCommon);
    const infoInfo = parseDetailIntro(detailIntro);
    const detailInfo = parseDetailInfo(detailInfoList.items.item);

    const result: Tour.API.GetOne.Result = {
        contentId, // 콘텐츠 ID
        contentTypeId, // 관광타입(관광지, 숙박 등) ID

        title: detailCommon.title, // 콘텐츠명(제목)
        overview: detailCommon.overview, // 콘텐츠 개요

        images, // 이미지

        normalInfo, // 기본 정보
        infoInfo, // 소개 정보
        detailInfo // 상세 정보
    }

    success(res, result);
};

export default {
    index,
    show
}

function parseDetailCommon(detailCommon) {
    const ans = [];

    for (const property in detailCommon) {
        if (!detailCommon.hasOwnProperty(property)) {
            continue;
        }

        let obj = {title: null, content: null};

        switch (property) {
            // defaultYN=Y (기본정보 조회)
            case "homepage":
                obj.title = "홈페이지 주소";
                break;
            case "tel":
                obj.title = "전화번호";
                break;
            case "telname":
                obj.title = "전화번호명";
                break;

            // addrinfoYN=Y (주소정보 조회)
            case "addr1":
                obj.title = "주소";
                break;
            case "addr2":
                obj.title = "상세주소";
                break;
            case "zipcode":
                obj.title = "우편번호";
                break;
            default:
                continue;
        }

        obj.content = detailCommon[property];

        ans.push(obj);
    }

    return ans;
}

function parseDetailIntro(detailIntro) {
    const ans = [];

    for (const property in detailIntro) {
        if (!detailIntro.hasOwnProperty(property)) {
            continue;
        }

        let obj = { title: null, content: null };

        switch (property) {
            // contentTypeId=12 (관광지)
            case "accomcount":
                obj.title = '수용인원';
                break;
            case "chkcreditcard":
                obj.title = '신용카드가능 정보';
                break;
            case "expagerange":
                obj.title = '체험가능 연령';
                break;
            case "expguide":
                obj.title = '체험안내';
                break;
            case "infocenter":
                obj.title = '문의 및 안내';
                break;
            case "opendate":
                obj.title = '개장일';
                break;
            case "parking":
                obj.title = '주차시설';
                break;
            case "restdate":
                obj.title = '쉬는날';
                break;
            case "useseason":
                obj.title = '이용시기';
                break;
            case "usetime":
                obj.title = '이용시간';
                break;

            // contentTypeId=14 (문화시설)
            case "accomcountculture":
                obj.title = "수용인원";
                break;
            case "chkbabycarriageculture":
                obj.title = "유모차대여 정보";
                break;
            case "chkcreditcardculture":
                obj.title = "신용카드가능 정보";
                break;
            case "chkpetculture":
                obj.title = "애완동물동반가능 정보";
                break;
            case "discountinfo":
                obj.title = "할인정보";
                break;
            case "infocenterculture":
                obj.title = "문의 및 안내";
                break;
            case "parkingculture":
                obj.title = "주차시설";
                break;
            case "parkingfee":
                obj.title = "주차요금";
                break;
            case "restdateculture":
                obj.title = "쉬는날";
                break;
            case "usefee":
                obj.title = "이용요금";
                break;
            case "usetimeculture":
                obj.title = "이용시간";
                break;
            case "scale":
                obj.title = "규모";
                break;
            case "spendtime":
                obj.title = "관람 소요시간";
                break;

            // contentTypeId=15 (행사/공연/축제)
            case "agelimit":
                obj.title = "관람 가능연령";
                break;
            case "bookingplace":
                obj.title = "예매처";
                break;
            case "discountinfofestival":
                obj.title = "할인정보";
                break;
            case "eventenddate":
                obj.title = "행사 종료일";
                break;
            case "eventhomepage":
                obj.title = "행사 홈페이지";
                break;
            case "eventplace":
                obj.title = "행사 장소";
                break;
            case "eventstartdate":
                obj.title = "행사 시작일";
                break;
            case "festivalgrade":
                obj.title = "축제등급";
                break;
            case "placeinfo":
                obj.title = "행사장 위치안내";
                break;
            case "playtime":
                obj.title = "공연시간";
                break;
            case "program":
                obj.title = "행사 프로그램";
                break;
            case "spendtimefestival":
                obj.title = "관람 소요시간";
                break;
            case "sponsor1":
                obj.title = "주최자 정보";
                break;
            case "sponsor1tel":
                obj.title = "주최자 연락처";
                break;
            case "sponsor2":
                obj.title = "주관사 정보";
                break;
            case "sponsor2tel":
                obj.title = "주관사 연락처";
                break;
            case "subevent":
                obj.title = "부대행사";
                break;
            case "usetimefestival":
                obj.title = "이용요금";
                break;

            // contentTypeId=25 (여행코스)
            case "distance":
                obj.title = "코스 총거리";
                break;
            case "infocentertourcourse":
                obj.title = "문의 및 안내";
                break;
            case "schedule":
                obj.title = "코스 일정";
                break;
            case "taketime":
                obj.title = "코스 총 소요시간";
                break;
            case "theme":
                obj.title = "코스 테마";
                break;

            // contentTypeId=28 (레포츠)
            case "accomcountleports":
                obj.title = "수용인원";
                break;
            case "chkcreditcardleports":
                obj.title = "신용카드가능 정보";
                break;
            case "expagerangeleports":
                obj.title = "체험 가능연령";
                break;
            case "infocenterleports":
                obj.title = "문의 및 안내";
                break;
            case "openperiod":
                obj.title = "개장기간";
                break;
            case "parkingfeeleports":
                obj.title = "주차요금";
                break;
            case "parkingleports":
                obj.title = "주차시설";
                break;
            case "reservation":
                obj.title = "예약안내";
                break;
            case "restdateleports":
                obj.title = "쉬는날";
                break;
            case "scaleleports":
                obj.title = "규모";
                break;
            case "usefeeleports":
                obj.title = "입장료";
                break;
            case "usetimeleports":
                obj.title = "이용시간";
                break;
            default:
                continue;
        }

        obj.content = detailIntro[property];

        ans.push(obj);
    }

    return ans;
}

function parseDetailInfo(detailInfoList) {
    if (typeof detailInfoList == "object") {
        detailInfoList = [detailInfoList];
    }

    return detailInfoList.map(item => {
        let ans = [];

        for (const property in item) {
            if (!item.hasOwnProperty(property)) {
                continue;
            }

            let obj = { title: null, content: null };

            switch (property) {
                // 여행코스 제외
                case "infoname":
                    obj = { title: item['infoname'], content: item['infotext'] };
                    break;

                // // contentTypeId=25 (여행코스)
                case "subcontentid":
                    obj = { title: "하위 콘텐츠ID", content: item[property] };
                    break;
                case "subdetailalt":
                    obj = { title: "코스이미지 설명", content: item[property] };
                    break;
                case "subdetailimg":
                    obj = { title: "코스이미지", content: item[property] };
                    break;
                case "subdetailoverview":
                    obj = { title: "코스개요", content: item[property] };
                    break;
                case "subname":
                    obj = { title: "코스명", content: item[property] };
                    break;
                case "subnum":
                    obj = { title: "반복 일련번호", content: item[property] };
                    break;
                default:
                    continue;
            }

            ans.push(obj);
        }

        return ans;
    });
}