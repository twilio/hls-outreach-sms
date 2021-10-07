# --------------------------------------------------------------------------------------------------------------
# to be used by demo developer
# --------------------------------------------------------------------------------------------------------------

ifndef ACCOUNT_SID
$(error 'ACCOUNT_SID enviroment variable not defined')
endif
ifndef AUTH_TOKEN
$(error 'AUTH_TOKEN enviroment variable not defined')
endif

APPLICATION_NAME := $(shell basename `pwd`)
$(info APPLICATION_NAME=$(APPLICATION_NAME))

USERNAME := $(shell whoami)
$(info USERNAME=$(USERNAME))


targets:
	@echo ---------- $@
	@grep '^[A-Za-z0-9\-]*:' Makefile | cut -d ':' -f 1 | sort


fetch-service-sid:
	@echo ---------- $@
	$(eval SERVICE_SID := $(shell curl https://serverless.twilio.com/v1/Services \
		--silent --user $(ACCOUNT_SID):$(AUTH_TOKEN) \
		| jq --raw-output '.services[] | select(.unique_name | contains("'$(APPLICATION_NAME)'")) | .sid'))
	@echo SERVICE_SID=$(SERVICE_SID)


delete: fetch-service-sid
	@echo ---------- $@
	$(info delete Functions Service)
	curl -X DELETE https://serverless.twilio.com/v1/Services/$(SERVICE_SID) \
		--silent --user $(ACCOUNT_SID):$(AUTH_TOKEN) | jq .

	$(info delete .twiliodeployinfo)
	rm -f .twiliodeployinfo


deploy-serverless:
	@echo ---------- $@
	twilio serverless:deploy


make-editable: fetch-service-sid
	@echo ---------- $@
	curl -X POST "https://serverless.twilio.com/v1/Services/$(SERVICE_SID)" \
	--data-urlencode "UiEditable=True" \
	--silent --user $(ACCOUNT_SID):$(AUTH_TOKEN) | jq .


deploy: deploy-serverless make-editable
	@echo ---------- $@
